import { sendEmail } from "./sendEmail.js";

// Fire-and-forget email alert for critical security events (an IP getting
// auto-blocked, an account getting locked out, content blocked as
// malicious). Reuses the same SMTP config as every other notification in
// this app — no separate "alerting service" env vars to configure.
// Slack/Discord/Teams alerting would each need their own incoming-webhook
// URL from the user before they could be wired up; email is the one
// channel that's already configured end-to-end.
export function sendSecurityAlert(type, detail, meta = {}) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER;
  if (!to) return; // no notify address configured - same silent-skip behavior as sendEmail itself

  const lines = [
    detail,
    "",
    ...Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`),
  ];

  sendEmail({
    to,
    subject: `[GivsiaTech Security] ${type.replace(/_/g, " ")}`,
    text: lines.join("\n"),
  });
}
