import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  purpose: { type: String, enum: ["register"], default: "register" },
  codeHash: { type: String, required: true },
  verified: { type: Boolean, default: false },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

// TTL index — Mongo auto-deletes the document once expiresAt passes, so
// stale/used codes never pile up and don't need manual cleanup.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Otp", otpSchema);
