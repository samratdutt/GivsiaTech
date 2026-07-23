import mongoose from "mongoose";

// A blocked IP is checked on every request (see middleware/ipBlocklist.js),
// so this collection stays small and hot by design — auto-blocks expire on
// their own (TTL below); only a "permanent" block (no expiresAt) persists.
const blockedIPSchema = new mongoose.Schema(
  {
    ip: { type: String, required: true, unique: true, trim: true },
    reason: { type: String, required: true },
    autoBlocked: { type: Boolean, default: false },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // set for a manual admin block
    violationCount: { type: Number, default: 1 }, // how many triggering events led here — escalates temp -> permanent
    // No expiresAt = permanent (manual blocks, or auto-blocks after repeat
    // offense). Auto-expired via the partial TTL index below when set.
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

blockedIPSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: "date" } } }
);

export default mongoose.model("BlockedIP", blockedIPSchema);
