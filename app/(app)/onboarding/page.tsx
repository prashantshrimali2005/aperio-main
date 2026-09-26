import { OnboardingForm } from "@/components/onboarding-form";
import { getRoles } from "@/lib/reports";
export const metadata={title:"Get started"};
export default async function OnboardingPage(){const roles=await getRoles();return <div className="mx-auto max-w-[980px] px-5 py-10 lg:px-10 lg:py-14"><div className="max-w-2xl"><p className="text-sm font-semibold text-[var(--primary)]">Welcome to Aperio</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Let’s understand where you are and where you want to go.</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">This sets your starting context. You can change every choice later.</p></div><div className="mt-8"><OnboardingForm roles={roles}/></div></div>;}
