const META: Record<string, { label: string; tone: string }> = {
  "auth.register": { label: "Registered", tone: "var(--positive)" },
  "auth.login": { label: "Signed in", tone: "var(--primary)" },
  "auth.login.google": { label: "Signed in · Google", tone: "var(--primary)" },
  "auth.logout": { label: "Signed out", tone: "var(--muted)" },
  "resume.upload": { label: "Uploaded résumé", tone: "var(--positive)" },
  "resume.rejected": { label: "Résumé rejected", tone: "var(--attention)" },
  "analysis.run": { label: "Ran analysis", tone: "var(--primary)" },
  "roadmap.update": { label: "Updated roadmap", tone: "var(--muted)" },
  "learning_path.generate": { label: "Generated course plan", tone: "var(--positive)" },
  "learning_module.update": { label: "Updated a module", tone: "var(--muted)" },
  "channel.link": { label: "Linked a channel", tone: "var(--positive)" },
  "channel.unlink": { label: "Unlinked a channel", tone: "var(--attention)" },
  "notification.batch": { label: "Notification batch", tone: "var(--muted)" },
  "admin.integration.save": { label: "Saved integration", tone: "var(--primary)" },
  "profile.update": { label: "Updated profile", tone: "var(--muted)" },
};

export function ActionLabel({ action }: { action: string }) {
  const meta = META[action] ?? { label: action, tone: "var(--muted)" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
      <span className="size-1.5 rounded-full" style={{ background: meta.tone }} />
      {meta.label}
    </span>
  );
}
