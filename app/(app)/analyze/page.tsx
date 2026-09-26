import { Sparkles } from "lucide-react";
import { AnalysisWorkbench, type Resume } from "@/components/analysis-workbench";
import { requirePageUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { getRoles } from "@/lib/reports";

export const metadata = { title: "Analyze" };
export default async function AnalyzePage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const user = await requirePageUser();
  const queryParams = await searchParams;
  const [roles, resumes] = await Promise.all([
    getRoles(user.id),
    query<Resume & Record<string, unknown>>(`SELECT id,filename,mime_type AS "mimeType",file_size AS "fileSize",status,
      document_type AS "documentType",validation_confidence AS "validationConfidence",
      processing_provider AS "processingProvider",processing_warnings AS warnings,
      parsed_data->>'candidateName' AS "candidateName",
      jsonb_array_length(COALESCE(parsed_data->'skills','[]'::jsonb)) AS "skillsDetected",
      created_at AS "createdAt" FROM resumes WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]),
  ]);

  return (
    <div className="mx-auto max-w-[1180px] px-5 py-8 lg:px-10 lg:py-10">
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-[8px] border bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--primary)]"><Sparkles size={13} />Gemini-powered evidence intelligence</div>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Turn your resume into a clear next move.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--muted)]">Choose a target role. Aperio verifies your resume, maps visible evidence to stored role requirements, and creates a roadmap grounded in what your profile demonstrates today.</p>
      </div>
      <div className="mt-8"><AnalysisWorkbench roles={roles} initialRoleId={queryParams.role} initialResumes={resumes} /></div>
    </div>
  );
}
