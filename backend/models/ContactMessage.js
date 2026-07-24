import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    company: { type: String, trim: true },
    // Matches a Service.key (see models/Service.js), or "other" — no longer
    // a fixed enum, since services are admin-managed and open-ended.
    serviceInterest: { type: String, trim: true, default: "other" },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
    // Set only for messages sent from a logged-in client's dashboard (as
    // opposed to the public, unauthenticated homepage contact form), so
    // admin can see who they're already a customer of and which project
    // they're asking about.
    client: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    // Set by the spam/content screen in utils/security.js — a "suspicious"
    // verdict doesn't block submission (avoids false-positive-rejecting a
    // real lead), it just surfaces here so admin can see it was flagged
    // before deciding to follow up.
    flaggedSpam: { type: Boolean, default: false },
    spamReasons: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("ContactMessage", contactMessageSchema);
