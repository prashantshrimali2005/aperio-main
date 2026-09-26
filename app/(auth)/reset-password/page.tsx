import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata = { title: "Set a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <>
        <p className="text-[13px] font-semibold text-[var(--primary)]">Account recovery</p>
        <h1 className="mt-2 text-[26px] font-semibold tracking-[-.04em] sm:text-3xl">Link incomplete</h1>
        <p className="mb-7 mt-2.5 text-sm leading-6 text-[var(--muted)]">
          This page needs a reset link from your email. Open the most recent &ldquo;Reset your Aperio password&rdquo;
          message, or{" "}
          <Link href="/forgot-password" className="font-semibold text-[var(--primary)] hover:underline">
            request a new link
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <p className="text-[13px] font-semibold text-[var(--primary)]">Account recovery</p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-.04em] sm:text-3xl">Set a new password</h1>
      <p className="mb-7 mt-2.5 text-sm leading-6 text-[var(--muted)]">
        Choose a new password for your account. You&rsquo;ll be signed out everywhere else.
      </p>
      <ResetPasswordForm token={token} />
    </>
  );
}
