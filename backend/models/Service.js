import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, trim: true }, // short eyebrow label, e.g. "Build", "Automate"
    title: { type: String, required: true, trim: true },
    copy: { type: String, required: true, trim: true },
    // Stable slug, set once at creation (see serviceRoutes.js) and never
    // regenerated on title edits — this is what Pricing.serviceKey links
    // against, so changing it after the fact would silently break any tier
    // already linked to this service.
    key: { type: String, required: true, trim: true, lowercase: true, unique: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
