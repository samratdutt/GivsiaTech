import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true }, // e.g. "From ₹25,000" — display text only
    // Numeric source of truth for the same figure `price` shows as text —
    // used to enforce the client-side request-a-project amount floor (see
    // paymentRoutes.js create-order: basePrice - 5000 is the lowest a
    // client can self-select). Kept separate from `price` since that
    // string isn't reliably parseable (formatting, "Custom quote", etc.).
    basePrice: { type: Number, min: 0 },
    // Matches Order.service — lets create-order look up "which tier governs
    // this service's floor" with a direct query instead of fuzzy-matching
    // display names. Only set for the tiers with a real Order.service
    // counterpart; a tier with no serviceKey (or "other") has no enforced floor.
    serviceKey: { type: String, enum: ["website", "ai-automation", "saas", "app-development"] },
    desc: { type: String, required: true, trim: true },
    features: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Pricing", pricingSchema);
