import mongoose from "mongoose";

const portfolioSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    tag: { type: String, required: true, trim: true }, // e.g. "E-commerce", "SaaS", "Coming soon"
    desc: { type: String, required: true, trim: true },
    stack: { type: String, trim: true }, // e.g. "React, Node.js, MongoDB"
    image: { type: String, trim: true }, // used as the card's background image on the site
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Portfolio", portfolioSchema);
