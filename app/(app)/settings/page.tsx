import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationSettings } from "@/components/notification-settings";
import { requirePageUser } from "@/lib/auth";
import { getIntegrationsState } from "@/lib/integrations";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  const integrations = await getIntegrationsState(user.id);
  return (
    <div className="mx-auto max-w-[800px] px-5 py-8 lg:px-10 lg:py-10">
      <p className="text-sm font-semibold text-[var(--primary)]">Workspace preferences</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">Settings</h1>

      <section className="mt-8 flex items-center justify-between rounded-[16px] border bg-[var(--surface)] p-5">
        <div>
          <h2 className="text-sm font-semibold">Appearance</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Switch between light and dark mode. System theme is used on first visit.</p>
        </div>
        <ThemeToggle />
      </section>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Connected messaging</h2>
      <div className="mt-3">
        <NotificationSettings initial={integrations} />
      </div>

      <section className="mt-8 rounded-[16px] border bg-[var(--surface)] p-5">
        <h2 className="text-sm font-semibold">Privacy and analysis</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Uploaded resumes are processed privately. Aperio stores extracted text and analysis records for your account and does not expose a public file URL. Messaging addresses are stored only to deliver the updates you enable.</p>
      </section>
    </div>
  );
}
