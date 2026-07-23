import mongoose from "mongoose";

// One outstanding reset token per user at a time — see /forgot-password,
// which deletes any existing doc for that user before creating a new one.
// Only the SHA-256 hash of the token is ever stored (same pattern as
// Otp.codeHash) so a database leak alone can't be used to reset accounts.
const passwordResetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// TTL index — Mongo auto-deletes the document once expiresAt passes, so
// stale/used tokens never pile up and don't need manual cleanup.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PasswordReset", passwordResetSchema);
