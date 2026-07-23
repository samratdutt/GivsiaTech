import mongoose from "mongoose";

const outreachSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true, trim: true },
    recipientName: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed"], required: true },
    error: { type: String },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Set when this outreach was sent from a BizLead's detail page (AI Lead
    // Finder / New Business Monitor) — lets that lead's communication
    // history query this same collection instead of keeping a second log.
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "BizLead" },
  },
  { timestamps: true }
);

export default mongoose.model("Outreach", outreachSchema);
