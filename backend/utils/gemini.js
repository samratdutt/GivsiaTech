const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Google's free tier occasionally returns 503 "model overloaded" under
// shared-capacity load — transient, not a real failure. A couple of quick
// retries clears most of these before they ever reach the caller as an
// error. Shared by chatRoutes.js (Givi) and outreachRoutes.js (cold
// outreach drafting) — same model, same retry behavior either way.
export async function callGeminiWithRetry(body, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    if (apiRes.ok) return apiRes;

    const isLast = i === attempts - 1;
    if (apiRes.status === 503 && !isLast) {
      await sleep(800 * (i + 1));
      continue;
    }
    return apiRes;
  }
}
