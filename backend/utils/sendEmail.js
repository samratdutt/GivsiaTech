import nodemailer from "nodemailer";

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) return null; // email not configured, fail silently

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

// Fire-and-forget for most callers (they don't await the result) — never
// let an email failure break the request that triggered it. Callers that
// DO need to know whether it actually sent (e.g. forgot-password deciding
// whether to expose a dev-mode fallback link) can await the returned
// { delivered } status, same shape as sendSms.js's return value.
export async function sendEmail({ to, subject, text, html }) {
  try {
    const t = getTransporter();
    if (!t) {
      console.log(`[email skipped - SMTP not configured] To: ${to} | ${subject}`);
      return { delivered: false };
    }
    await t.sendMail({
      from: process.env.EMAIL_FROM || "GivsiaTech <no-reply@givsiatech.com>",
      to,
      subject,
      text,
      html,
    });
    return { delivered: true };
  } catch (err) {
    console.error("Email send failed:", err.message);
    return { delivered: false, attempted: true, error: err.message };
  }
}
