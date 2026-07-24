import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    tag: { type: String, required: true, trim: true }, // short eyebrow label, e.g. "Build", "Automate"
    title: { type: String, required: true, trim: true },
    copy: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
