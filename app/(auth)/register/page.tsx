import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Create account" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><p className="text-[13px] font-semibold text-[var(--primary)]">Start with your evidence</p><h1 className="mt-2 text-[26px] font-semibold tracking-[-.04em] sm:text-3xl">Create your Aperio account</h1><p className="mb-7 mt-2.5 text-sm leading-6 text-[var(--muted)]">Your workspace starts clean. Add your own profile or resume to generate results.</p><AuthForm mode="register" oauthError={error} /></>;
}
