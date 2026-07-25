import mongoose from "mongoose";

const visitorSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    ip: { type: String },
    userAgent: { type: String },
    browser: { type: String },
    os: { type: String },
    deviceType: { type: String, enum: ["desktop", "mobile", "tablet", "unknown"], default: "unknown" },
    referrer: { type: String },
    // Capped list of recently viewed paths (see visitorRoutes.js's $slice),
    // most recent last — enough to see a visitor's rough path through the
    // site without growing unbounded on a long-lived session.
    pages: { type: [String], default: [] },
    visitCount: { type: Number, default: 0 },
    firstSeen: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Rolling analytics, not a permanent business record (mirrors ActivityLog's
// TTL approach) — auto-expire a session 90 days after its last activity.
visitorSessionSchema.index({ lastSeen: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export default mongoose.model("VisitorSession", visitorSessionSchema);
