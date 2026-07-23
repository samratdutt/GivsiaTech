import crypto from "crypto";

// Constant-time string comparison for anything security-sensitive (HMAC
// signatures, invite codes) — a plain `===`/`!==` short-circuits on the
// first mismatched byte, which leaks how many leading characters were
// correct through response timing. crypto.timingSafeEqual needs equal-length
// buffers, so a length mismatch is handled as an immediate, definite
// non-match rather than throwing — but still performs a dummy comparison
// first so returning early on length alone doesn't itself become a new
// (much coarser) timing signal.
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
