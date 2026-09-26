import "server-only";

import { primaryOrigin } from "@/lib/origin";
import { getIntegrationRuntime } from "@/lib/settings";

export interface EmailConfig {
  provider: "smtp" | null;
  fromName: string;
  fromEmail: string;
}

interface ResolvedConfig {
  ready: boolean;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  host: string;
  port: number;
  user: string;
  pass: string;
}

async function resolveConfig(): Promise<ResolvedConfig> {
  try {
    const smtp = await getIntegrationRuntime("email.smtp");
    const host = String(smtp.config.host ?? "").trim();
    const user = String(smtp.config.user ?? "").trim();
    const pass = smtp.secret("pass") ?? "";
    const port = Number(smtp.config.port ?? 587) || 587;
    return {
      ready: Boolean(host && user && pass),
      enabled: smtp.enabled,
      fromName: String(smtp.config.fromName ?? "").trim() || "Aperio",
      fromEmail: String(smtp.config.fromEmail ?? "").trim() || user,
      host,
      port,
      user,
      pass,
    };
  } catch {
    return { ready: false, enabled: false, fromName: "Aperio", fromEmail: "", host: "", port: 587, user: "", pass: "" };
  }
}

export async function getEmailConfig(): Promise<EmailConfig> {
  const c = await resolveConfig();
  return { provider: c.ready && c.enabled ? "smtp" : null, fromName: c.fromName, fromEmail: c.fromEmail };
}

export async function isEmailConfigured() {
  const c = await resolveConfig();
  return c.ready && c.enabled;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  opts: { requireEnabled?: boolean } = {},
) {
  const c = await resolveConfig();
  if (!c.ready) throw new Error("EMAIL_NOT_CONFIGURED");
  if ((opts.requireEnabled ?? true) && !c.enabled) throw new Error("EMAIL_DISABLED");

  const from = `${c.fromName} <${c.fromEmail}>`;
  const plain = text ?? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const nodemailer = (await import("nodemailer")).default;
  const transporter = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.port === 465,
    auth: { user: c.user, pass: c.pass },
  });
  await transporter.sendMail({ from, to, subject, text: plain, html });
}

// --- template kit ----------------------------------------------------------

const APP_URL = primaryOrigin("https://aperio-umber.vercel.app");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function shell(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="font-weight:800;font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:#4f46e5">Aperio</div>
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;margin-top:14px">${inner}</div>
    <p style="font-size:11px;color:#9ca3af;margin:16px 4px 0">Sent because email updates are on for your Aperio account. Manage them in Settings → Connected messaging.</p>
  </div></body></html>`;
}

function heading(t: string) {
  return `<h1 style="margin:0 0 6px;font-size:21px;line-height:1.25">${esc(t)}</h1>`;
}
function lede(t: string) {
  return `<p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#4b5563">${esc(t)}</p>`;
}
function cta(label: string, href: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:22px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:11px">${esc(label)} &rarr;</a>`;
}
function pills(items: Array<{ label: string; value: string; tone?: string }>) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 10px"><tr>${items
    .map(
      (i) =>
        `<td style="padding:0 6px 0 0"><div style="background:#f9fafb;border:1px solid #eceef1;border-radius:12px;padding:12px 14px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af">${esc(i.label)}</div><div style="margin-top:4px;font-size:19px;font-weight:700;color:${i.tone ?? "#111827"}">${esc(i.value)}</div></div></td>`,
    )
    .join("")}</tr></table>`;
}
function bullets(items: string[]) {
  if (!items.length) return "";
  return `<ul style="margin:6px 0 0;padding-left:18px;color:#374151;font-size:13px;line-height:1.7">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}
function subtle(t: string) {
  return `<p style="margin:16px 0 0;font-size:11px;color:#9ca3af;line-height:1.5">${esc(t)}</p>`;
}
function kv(rows: Array<{ label: string; value: string | null | undefined }>) {
  const cells = rows
    .filter((r) => r.value != null && String(r.value).trim() !== "")
    .map(
      (r) =>
        `<tr><td style="padding:9px 12px;border-bottom:1px solid #f1f2f4;font-size:12px;color:#6b7280;white-space:nowrap;vertical-align:top">${esc(r.label)}</td>` +
        `<td style="padding:9px 12px;border-bottom:1px solid #f1f2f4;font-size:13px;color:#111827;font-weight:600">${esc(String(r.value))}</td></tr>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0 4px;border:1px solid #eceef1;border-radius:12px;border-collapse:separate;overflow:hidden">${cells}</table>`;
}
function warnNote(t: string) {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:10px 12px">${esc(t)}</p>`;
}

export type NotificationEmailKind = "welcome" | "analysis" | "weekly_digest" | "roadmap" | "inactivity";

export interface NotificationEmailData {
  firstName?: string;
  roleTitle?: string | null;
  overall?: number | null;
  technical?: number | null;
  soft?: number | null;
  matched?: number;
  developing?: number;
  missing?: number;
  topGaps?: string[];
  completed?: number;
  pending?: number;
  nextSkill?: string | null;
  nextAction?: string | null;
}

export function buildNotificationEmail(kind: NotificationEmailKind, d: NotificationEmailData) {
  const hi = d.firstName ? `${d.firstName}, ` : "";

  if (kind === "analysis") {
    return {
      subject: d.roleTitle ? `Your ${d.roleTitle} analysis is ready` : "Your analysis is ready",
      html: shell(
        heading(`${hi}your analysis is ready`) +
          lede(`Here's how your current evidence maps to ${d.roleTitle ?? "the role"}.`) +
          pills([
            { label: "Overall", value: `${d.overall ?? "—"}%` },
            { label: "Technical", value: `${d.technical ?? "—"}%`, tone: "#4f46e5" },
            { label: "Professional", value: `${d.soft ?? "—"}%`, tone: "#0f766e" },
          ]) +
          `<p style="margin:8px 0 0;font-size:13px;color:#4b5563">${d.matched ?? 0} matched &middot; ${d.developing ?? 0} developing &middot; ${d.missing ?? 0} to close.</p>` +
          (d.topGaps?.length ? `<p style="margin:16px 0 4px;font-size:13px;font-weight:600">Highest-impact gaps</p>${bullets(d.topGaps)}` : "") +
          cta("Open the report", `${APP_URL}/history`) +
          subtle("Take the optional skills check to verify these levels — your answers feed the score and course plan."),
      ),
      text: `${hi}your ${d.roleTitle ?? ""} analysis is ready. Overall ${d.overall ?? "—"}%, technical ${d.technical ?? "—"}%, professional ${d.soft ?? "—"}%. ${d.missing ?? 0} gaps to close. Open ${APP_URL}/history`,
    };
  }

  if (kind === "weekly_digest") {
    const head = d.roleTitle ? `${d.roleTitle} — ${d.overall ?? "—"}% match` : "No analysis yet — run one to start tracking.";
    return {
      subject: "Your Aperio week",
      html: shell(
        heading(`${hi}here's your week`) +
          lede(head) +
          pills([
            { label: "Match", value: `${d.overall ?? "—"}%` },
            { label: "Steps done", value: `${d.completed ?? 0}`, tone: "#0f766e" },
            { label: "Steps open", value: `${d.pending ?? 0}`, tone: "#b45309" },
          ]) +
          (d.nextSkill ? `<p style="margin:12px 0 0;font-size:13px;color:#4b5563"><b>Finish this week:</b> ${esc(d.nextSkill)}${d.nextAction ? ` — ${esc(d.nextAction)}` : ""}</p>` : "") +
          cta("Continue your plan", `${APP_URL}/learning`),
      ),
      text: `${hi}${head} Roadmap: ${d.completed ?? 0} done, ${d.pending ?? 0} open. ${d.nextSkill ? `Next: ${d.nextSkill}.` : ""} ${APP_URL}/learning`,
    };
  }

  if (kind === "roadmap") {
    return {
      subject: "Keep your roadmap moving",
      html: shell(
        heading(`${hi}${d.pending ?? 0} step${d.pending === 1 ? "" : "s"} still open`) +
          lede(`Next up: ${d.nextSkill ?? "your top gap"}.`) +
          (d.nextAction ? `<p style="margin:0;font-size:13px;line-height:1.6;color:#374151">${esc(d.nextAction)}</p>` : "") +
          cta("Open roadmap", `${APP_URL}/roadmap`) +
          subtle("Ten focused minutes keeps the momentum going. Marking a step is progress, not proof of mastery — re-run an analysis to see evidence-based movement."),
      ),
      text: `${hi}${d.pending ?? 0} roadmap step(s) open. Next: ${d.nextSkill ?? ""}. ${d.nextAction ?? ""} ${APP_URL}/roadmap`,
    };
  }

  // inactivity
  return {
    subject: "Pick your progress back up",
    html: shell(
      heading(`${hi}it's been a quiet week`) +
        lede("Your plan is still here whenever you're ready.") +
        `<p style="margin:0;font-size:13px;line-height:1.6;color:#374151">Ten focused minutes on your top roadmap step is enough to keep moving.</p>` +
        cta("Jump back in", `${APP_URL}/overview`),
    ),
    text: `${hi}it's been a quiet week on Aperio. Ten minutes on your top roadmap step keeps momentum. ${APP_URL}/overview`,
  };
}

/** Fallback for any notification text with no dedicated template. */
export function notificationEmail(rawText: string) {
  const lines = rawText.split("\n").map((l) => l.replace(/<\/?b>/g, "").trim());
  const subject = lines[0] || "Aperio update";
  const body = lines.slice(1).filter(Boolean).map((l) => `<p style="margin:0 0 10px;font-size:13px;color:#374151;line-height:1.6">${esc(l)}</p>`).join("");
  return { subject, html: shell(heading(subject) + body + cta("Open Aperio", `${APP_URL}/overview`)), text: rawText.replace(/<\/?b>/g, "") };
}

// --- security / transactional emails -------------------------------------

export interface SignInEmailData {
  firstName?: string;
  method: string; // "password", "Google", ...
  deviceLabel: string;
  locationLabel: string;
  ip?: string | null;
  isp?: string | null;
  when: string;
  isNewLocation?: boolean;
}

export function buildSignInEmail(d: SignInEmailData) {
  const hi = d.firstName ? `${d.firstName}, ` : "";
  const what = d.isNewLocation ? "a sign-in from a new location" : "a sign-in from a new device";
  return {
    subject: d.isNewLocation ? "New sign-in location on your Aperio account" : "New sign-in to your Aperio account",
    html: shell(
      heading(`${hi}we noticed ${what}`) +
        lede("If this was you, no action is needed. Here are the details we recorded:") +
        kv([
          { label: "When", value: d.when },
          { label: "Method", value: d.method },
          { label: "Device", value: d.deviceLabel },
          { label: "Location", value: d.locationLabel },
          { label: "IP address", value: d.ip ?? undefined },
          { label: "ISP / network", value: d.isp ?? undefined },
        ]) +
        cta("Review account security", `${APP_URL}/profile`) +
        warnNote("Not you? Change your password now and sign out other sessions from Profile → Security."),
    ),
    text:
      `${hi}${what} on your Aperio account.\n` +
      `When: ${d.when}\nMethod: ${d.method}\nDevice: ${d.deviceLabel}\nLocation: ${d.locationLabel}\n` +
      `IP: ${d.ip ?? "—"}\nISP: ${d.isp ?? "—"}\n\n` +
      `Not you? Change your password: ${APP_URL}/profile`,
  };
}

export interface PurchaseEmailData {
  firstName?: string;
  title: string;
  itemType: "course" | "question_set";
  amountInr: number;
  currency?: string;
  orderId?: string | null;
  paymentId?: string | null;
  when: string;
}

export function buildPurchaseEmail(d: PurchaseEmailData) {
  const hi = d.firstName ? `${d.firstName}, ` : "";
  const kind = d.itemType === "course" ? "course" : "question set";
  const amount = `${d.currency ?? "INR"} ${d.amountInr.toLocaleString("en-IN")}`;
  const href = d.itemType === "course" ? `${APP_URL}/learning` : `${APP_URL}/practice`;
  return {
    subject: `Your Aperio receipt — ${d.title}`,
    html: shell(
      heading(`${hi}thanks for your purchase`) +
        lede(`You now have full access to the ${kind} “${d.title}”.`) +
        kv([
          { label: "Item", value: d.title },
          { label: "Type", value: kind },
          { label: "Amount paid", value: amount },
          { label: "Order ID", value: d.orderId ?? undefined },
          { label: "Payment ID", value: d.paymentId ?? undefined },
          { label: "Date", value: d.when },
        ]) +
        cta(d.itemType === "course" ? "Start learning" : "Open your practice sets", href) +
        subtle("Keep this email as your receipt. Payments are processed securely by Razorpay."),
    ),
    text:
      `${hi}thanks for your purchase.\n` +
      `Item: ${d.title} (${kind})\nAmount: ${amount}\nOrder ID: ${d.orderId ?? "—"}\nPayment ID: ${d.paymentId ?? "—"}\nDate: ${d.when}\n\n` +
      `Access it here: ${href}`,
  };
}

export interface AccountChangeEmailData {
  firstName?: string;
  summary: string; // "Your name was changed", "Google sign-in was linked", ...
  detail?: string | null;
  deviceLabel?: string;
  locationLabel?: string;
  ip?: string | null;
  when: string;
}

export function buildAccountChangeEmail(d: AccountChangeEmailData) {
  const hi = d.firstName ? `${d.firstName}, ` : "";
  return {
    subject: "Your Aperio account was updated",
    html: shell(
      heading(`${hi}${d.summary.toLowerCase()}`) +
        lede(d.detail || "This is a confirmation that a change was made to your account.") +
        kv([
          { label: "Change", value: d.summary },
          { label: "When", value: d.when },
          { label: "Device", value: d.deviceLabel },
          { label: "Location", value: d.locationLabel },
          { label: "IP address", value: d.ip ?? undefined },
        ]) +
        cta("Open your profile", `${APP_URL}/profile`) +
        warnNote("Didn't make this change? Change your password immediately and contact support."),
    ),
    text:
      `${hi}${d.summary}.\n${d.detail ?? ""}\n` +
      `When: ${d.when}\nDevice: ${d.deviceLabel ?? "—"}\nLocation: ${d.locationLabel ?? "—"}\nIP: ${d.ip ?? "—"}\n\n` +
      `Didn't do this? Change your password: ${APP_URL}/profile`,
  };
}

export interface PasswordResetEmailData {
  firstName?: string;
  url: string;
  ip?: string | null;
  when: string;
  ttlMinutes: number;
}

export function buildPasswordResetEmail(d: PasswordResetEmailData) {
  const hi = d.firstName ? `${d.firstName}, ` : "";
  return {
    subject: "Reset your Aperio password",
    html: shell(
      heading(`${hi}reset your password`) +
        lede(`We got a request to reset the password on your Aperio account. This link works once and expires in ${d.ttlMinutes} minutes.`) +
        cta("Choose a new password", d.url) +
        `<p style="margin:18px 0 0;font-size:12px;color:#6b7280;line-height:1.6">Or paste this link into your browser:<br><span style="word-break:break-all;color:#4f46e5">${esc(d.url)}</span></p>` +
        kv([
          { label: "Requested", value: d.when },
          { label: "IP address", value: d.ip ?? undefined },
        ]) +
        warnNote("Didn't ask for this? You can ignore this email — your password stays unchanged. If you get these repeatedly, change your password as a precaution."),
    ),
    text:
      `${hi}reset your Aperio password.\n\n${d.url}\n\n` +
      `This link works once and expires in ${d.ttlMinutes} minutes. Requested ${d.when}${d.ip ? ` from ${d.ip}` : ""}.\n` +
      `Didn't ask for this? Ignore this email — nothing changes.`,
  };
}

/** Sent when a reset is requested for an account that only has Google sign-in. */
export function buildPasswordResetGoogleEmail(d: { firstName?: string; email: string; when: string }) {
  const hi = d.firstName ? `${d.firstName}, ` : "";
  return {
    subject: "Reset your Aperio password",
    html: shell(
      heading(`${hi}use “Sign in with Google”`) +
        lede(`Someone asked to reset the password for ${d.email}, but this account doesn't use a password — it signs in with Google.`) +
        cta("Go to sign in", `${APP_URL}/login`) +
        subtle(`Requested ${d.when}. If this wasn't you, no action is needed; there is no password to change.`),
    ),
    text:
      `${hi}the Aperio account for ${d.email} signs in with Google and has no password to reset.\n` +
      `Sign in here: ${APP_URL}/login\nRequested ${d.when}.`,
  };
}

interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Low-level sender for security / transactional mail. Silently no-ops when the
 * admin hasn't enabled the SMTP integration (same rule as the welcome email).
 */
export async function sendSecurityEmail(to: string, email: BuiltEmail, label: string) {
  if (!(await isEmailConfigured())) return;
  await sendEmail(to, email.subject, email.html, email.text).catch((error) =>
    console.error(`${label} email failed`, error instanceof Error ? error.message : error),
  );
}

export async function sendWelcomeEmail(user: { email: string; fullName: string }) {
  if (!(await isEmailConfigured())) return;
  const first = user.fullName.trim().split(" ")[0] || "there";
  await sendEmail(
    user.email,
    "Welcome to Aperio",
    shell(
      heading(`Welcome, ${first}`) +
        lede("Aperio maps what your résumé and profile actually prove against what a target role needs, then turns the gap into a plan.") +
        `<p style="margin:0;font-size:13px;color:#374151;line-height:1.7">Add a résumé or fill your profile, pick a role, and run your first analysis. You'll get an evidence-linked skill breakdown, a technical / professional readiness split, a weekly course plan, and matched job openings.</p>` +
        cta("Start your first analysis", `${APP_URL}/analyze`),
    ),
  ).catch((error) => console.error("welcome email failed", error instanceof Error ? error.message : error));
}

/** Test-connection helper: sends a real email to `to`, ignoring the Enabled toggle. */
export async function sendTestEmail(to: string) {
  await sendEmail(
    to,
    "Aperio email test",
    shell(
      heading("Email is working") +
        `<p style="margin:0;font-size:13px;color:#374151;line-height:1.6">This is a test from Aperio's admin integrations page. Tick <b>Enabled</b> and Save so notification emails actually go out.</p>`,
    ),
    undefined,
    { requireEnabled: false },
  );
}
