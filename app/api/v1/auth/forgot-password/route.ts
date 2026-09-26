import { after } from "next/server";
import { handleApiError, ok } from "@/lib/api";
import { requestPasswordReset } from "@/lib/password-reset";
import { forgotPasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { email } = forgotPasswordSchema.parse(await request.json());
    // Do the lookup + send after responding so timing never reveals whether the
    // address exists. The response is always the same.
    after(() => requestPasswordReset(email, request));
    return ok({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}
