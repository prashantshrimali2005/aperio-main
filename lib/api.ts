import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: string, message: string, status = 400) {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) return fail("VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request", 422);
  if (error instanceof Error && error.message === "UNAUTHORIZED") return fail("UNAUTHORIZED", "Please sign in to continue.", 401);
  if (error instanceof Error && error.message === "FORBIDDEN") return fail("FORBIDDEN", "You do not have access to this resource.", 403);
  if (error instanceof Error && error.message.includes("DATABASE_URL")) return fail("SERVICE_NOT_CONFIGURED", "Database access is not configured.", 503);
  console.error("API error", error);
  return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
}
