import { randomUUID } from "node:crypto";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import { requireUser } from "@/lib/auth";
import { fail, handleApiError, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { inspectResumeWithGemini, isGeminiConfigured } from "@/lib/gemini";

const MAX_BYTES = 5 * 1024 * 1024;
const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const JPEG = "image/jpeg";
const PNG = "image/png";
const WEBP = "image/webp";
const SUPPORTED_TYPES = [PDF, DOCX, JPEG, PNG, WEBP];

export const runtime = "nodejs";
export const maxDuration = 60;

function hasValidMagic(bytes: Uint8Array, mimeType: string) {
  if (mimeType === PDF) return new TextDecoder().decode(bytes.slice(0, 4)) === "%PDF";
  if (mimeType === DOCX) return bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (mimeType === JPEG) return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === PNG) return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (mimeType === WEBP) return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  return false;
}

async function extractLocalText(bytes: Uint8Array, mimeType: string) {
  try {
    if (mimeType === PDF) return (await extractText(bytes, { mergePages: true })).text;
    if (mimeType === DOCX) return (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
  } catch (error) {
    console.warn("Local resume text extraction was unavailable; Gemini vision will be used", error instanceof Error ? error.message : "unknown error");
  }
  return "";
}

function isGeminiAuthenticationError(error: unknown) {
  return Boolean(error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401);
}

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await query(`SELECT id,filename,mime_type AS "mimeType",file_size AS "fileSize",status,
      document_type AS "documentType",validation_confidence AS "validationConfidence",
      processing_provider AS "processingProvider",processing_warnings AS warnings,
      parsed_data->>'candidateName' AS "candidateName",created_at AS "createdAt"
      FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]));
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return fail("VALIDATION_ERROR", "Choose a PDF or DOCX resume.", 422);
    if (file.size <= 0 || file.size > MAX_BYTES) return fail("FILE_SIZE_INVALID", "Resume files must be between 1 byte and 5 MB.", 422);
    if (!SUPPORTED_TYPES.includes(file.type)) return fail("FILE_TYPE_INVALID", "Upload a PDF, DOCX, JPG, PNG, or WebP resume.", 422);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (!hasValidMagic(bytes, file.type)) return fail("FILE_CONTENT_INVALID", "The file contents do not match the selected format.", 422);
    if (!isGeminiConfigured()) return fail("AI_NOT_CONFIGURED", "Gemini resume intelligence is not configured. Add GEMINI_API_KEY in the server environment.", 503);

    const localText = await extractLocalText(bytes, file.type);
    const filename = file.name.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._ ()-]/g, "_").slice(0, 160) || "resume";
    let inspection;
    try {
      inspection = await inspectResumeWithGemini({ filename, mimeType: file.type, bytes, localText });
    } catch (error) {
      console.error("Gemini resume inspection failed", error instanceof Error ? error.message : "unknown error");
      if (isGeminiAuthenticationError(error)) return fail("AI_AUTH_FAILED", "The configured Gemini API key was rejected. Update GEMINI_API_KEY and try again.", 503);
      return fail("AI_PROCESSING_FAILED", "Aperio could not verify this document right now. Please try again.", 502);
    }
    if (!inspection.isResume || inspection.confidence < 0.72) {
      await logActivity({ action: "resume.rejected", userId: user.id, metadata: { documentType: inspection.documentType, confidence: inspection.confidence }, request });
      return fail("NOT_A_RESUME", inspection.rejectionReason || "This file does not appear to be a professional resume or CV.", 422);
    }

    const text = (inspection.extractedText || localText).replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim().slice(0, 250_000);
    if (text.length < 40) return fail("RESUME_TEXT_MISSING", "We could not find enough readable text in this resume.", 422);

    const id = randomUUID();
    await query(
      `INSERT INTO resumes (id,user_id,filename,mime_type,file_size,extracted_text,status,document_type,
       validation_confidence,parsed_data,processing_provider,processing_warnings)
       VALUES ($1,$2,$3,$4,$5,$6,'processed',$7,$8,$9::jsonb,'gemini',$10::jsonb)`,
      [id, user.id, filename, file.type, file.size, text, inspection.documentType, inspection.confidence, JSON.stringify(inspection), JSON.stringify(inspection.warnings)],
    );
    await logActivity({
      action: "resume.upload", userId: user.id, entityType: "resume", entityId: id,
      metadata: { documentType: inspection.documentType, confidence: inspection.confidence, skills: inspection.skills.length },
      request,
    });
    return ok({
      id, filename, mimeType: file.type, fileSize: file.size, status: "processed",
      documentType: inspection.documentType, validationConfidence: inspection.confidence,
      processingProvider: "gemini", candidateName: inspection.candidateName,
      skillsDetected: inspection.skills.length, warnings: inspection.warnings,
    }, { status: 201 });
  } catch (error) { return handleApiError(error); }
}
