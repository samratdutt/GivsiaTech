import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // unset for anonymous actions (e.g. registering)
    userName: { type: String },
    role: { type: String, default: "anonymous" },
    method: { type: String, required: true },
    path: { type: String, required: true },
    action: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String },
  },
  { timestamps: true }
);

// This is an activity feed, not a permanent business record (Orders/Users/
// Outreach already store the actual data) — auto-expire after 30 days so
// the collection doesn't grow forever.
activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("ActivityLog", activityLogSchema);
