import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <><p className="text-[13px] font-semibold text-[var(--primary)]">Welcome back</p><h1 className="mt-2 text-[26px] font-semibold tracking-[-.04em] sm:text-3xl">Sign in to your workspace</h1><p className="mb-7 mt-2.5 text-sm leading-6 text-[var(--muted)]">Continue tracking your role readiness and learning progress.</p><AuthForm mode="login" oauthError={error} /></>;
}
