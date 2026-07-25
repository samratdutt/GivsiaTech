import mongoose from "mongoose";

const visitorLeadSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    // Links back to the VisitorSession this signup came from, if the
    // visitor had analytics cookies on — informational only, never
    // required (the opt-in form works standalone regardless of cookie choice).
    sessionId: { type: String },
    // Always true — a record only exists here because the visitor
    // submitted the explicit "send me info" form (see CookieConsent.jsx),
    // a separate action from cookie consent. Kept as an explicit field
    // rather than merely implied by the record's existence.
    consent: { type: Boolean, default: true },
    emailedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model("VisitorLead", visitorLeadSchema);
