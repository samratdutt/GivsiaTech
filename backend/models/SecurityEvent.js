import mongoose from "mongoose";

// One row per security-relevant signal — rate limits tripped, failed logins,
// account lockouts, IPs auto/manually blocked, and content flagged by the
// spam/prompt-injection screen. This is a detection log, not the block
// decision itself (see BlockedIP for that) — it's what the admin Security
// tab reads to answer "what's actually been happening."
const securityEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        "rate_limit_exceeded",
        "login_failed",
        "account_locked",
        "ip_blocked",
        "ip_unblocked",
        "spam_detected",
        "prompt_injection_detected",
        "upload_rejected",
        "password_reset_requested",
        "password_reset_completed",
      ],
    },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
    ip: { type: String },
    path: { type: String },
    email: { type: String }, // best-effort identity hint, e.g. the email a failed login was attempted against
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    detail: { type: String, required: true },
    meta: { type: mongoose.Schema.Types.Mixed }, // e.g. { reasons: [...], confidence: 82 }
  },
  { timestamps: true }
);

// A detection log grows fast (every rate-limit hit, every failed login) —
// auto-expire after 90 days so it doesn't grow forever, longer than
// ActivityLog's 30 days since security patterns are worth reviewing over a
// longer window.
securityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
securityEventSchema.index({ type: 1, createdAt: -1 });
securityEventSchema.index({ ip: 1, createdAt: -1 });

export default mongoose.model("SecurityEvent", securityEventSchema);
