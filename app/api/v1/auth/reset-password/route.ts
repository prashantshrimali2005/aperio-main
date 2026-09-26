import { after } from "next/server";
import { fail, handleApiError, ok } from "@/lib/api";
import { resetPassword } from "@/lib/password-reset";
import { notifyAccountChange } from "@/lib/security-emails";
import { resetPasswordSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { token, password } = resetPasswordSchema.parse(await request.json());
    const { userId } = await resetPassword(token, password);
    after(() =>
      notifyAccountChange({
        userId,
        summary: "Your password was changed",
        detail:
          "Your Aperio password was reset using a link from the “forgot password” email. All other sessions have been signed out.",
        request,
      }),
    );
    return ok({ reset: true });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_TOKEN") {
      return fail("INVALID_TOKEN", "This reset link is invalid or has expired. Request a new one.", 400);
    }
    return handleApiError(error);
  }
}
