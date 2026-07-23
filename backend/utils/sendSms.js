import twilio from "twilio";

let client;

function getClient() {
  if (client) return client;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null; // SMS not configured
  client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return client;
}

export function isSmsConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

// Falls back to logging the code to the server console when Twilio isn't
// configured, same pattern as sendEmail.js with SMTP — lets registration
// work end-to-end in dev before real SMS credentials are added.
export async function sendSms({ to, body }) {
  const t = getClient();
  if (!t || !process.env.TWILIO_PHONE_NUMBER) {
    console.log(`[sms skipped - Twilio not configured] To: ${to} | ${body}`);
    return { delivered: false };
  }

  try {
    await t.messages.create({ to, from: process.env.TWILIO_PHONE_NUMBER, body });
    return { delivered: true };
  } catch (err) {
    // Never let a Twilio failure (e.g. an unverified "to" number on a trial
    // account) crash the request — fall through to the dev-code fallback.
    // `attempted: true` tells the caller this wasn't a "not configured" skip,
    // so the response can say what actually went wrong instead of masking it.
    console.error("Twilio send failed:", err.code, err.message);
    return { delivered: false, attempted: true, error: err.message };
  }
}
