import { ForgotPasswordForm } from "@/components/forgot-password-form";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <p className="text-[13px] font-semibold text-[var(--primary)]">Account recovery</p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-.04em] sm:text-3xl">Reset your password</h1>
      <p className="mb-7 mt-2.5 text-sm leading-6 text-[var(--muted)]">
        Enter the email you sign in with. If there&rsquo;s an account, we&rsquo;ll send a link to set a new password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
