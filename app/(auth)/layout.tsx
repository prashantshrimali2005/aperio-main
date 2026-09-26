import { Check } from "lucide-react";
import { AperioBrand } from "@/components/aperio-brand";

// Direct MP4 for the ambient background on the right panel. Local file by
// default; override with any hosted .mp4 via NEXT_PUBLIC_AUTH_VIDEO_URL.
const VIDEO_URL = process.env.NEXT_PUBLIC_AUTH_VIDEO_URL || "/auth-bg.mp4";

const points = ["Evidence-linked skills", "Role-specific gaps", "A plan you can follow"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] lg:grid-cols-[.9fr_1.1fr]">
      <section className="flex flex-col bg-[var(--surface)] px-5 py-6 sm:px-10 sm:py-8 lg:px-16">
        <AperioBrand />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10 sm:py-14">{children}</div>
        <p className="text-center text-xs text-[var(--muted)]">Guidance based on the profile evidence you provide.</p>
      </section>

      <section className="relative hidden overflow-hidden border-l bg-[#070c15] lg:block">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-90 [filter:grayscale(100%)_brightness(.5)_contrast(1.08)] motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          src={VIDEO_URL}
        />

        {/* brand glow + legibility scrims + grid texture */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_85%_0%,rgba(79,70,229,.42),transparent_55%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070c15] via-[#070c15]/78 to-[#070c15]/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#070c15]/85 via-transparent to-transparent" />
        <div className="absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(255,255,255,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:44px_44px]" />

        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-[#aab0c4]">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-[var(--primary)]" />
            </span>
            Career readiness intelligence
          </div>

          <div className="max-w-xl text-white">
            <h2 className="text-[2.6rem] font-semibold leading-[1.08] tracking-[-.04em] [text-shadow:0_2px_30px_rgba(0,0,0,.55)] xl:text-[3.1rem]">
              Understand the evidence.<br />Close the right gap.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-[#c4c9d8] [text-shadow:0_1px_18px_rgba(0,0,0,.5)]">
              Aperio maps what your profile actually proves against what your target role needs &mdash; then turns the gap into a plan you can follow week by week.
            </p>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] font-medium text-[#d5d9e4]">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <span className="grid size-4 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_28%,transparent)] text-white"><Check size={11} strokeWidth={3} /></span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
