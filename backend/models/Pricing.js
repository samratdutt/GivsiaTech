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
    // Matches a Service.key (see backend/models/Service.js) so the admin can
    // link a tier to whichever service card it corresponds to. Only the
    // original 4 keys ("website", "ai-automation", "saas", "app-development")
    // also match an Order.service value — those are what create-order looks
    // up to enforce a price floor (see paymentRoutes.js); a tier linked to
    // any other/custom service key still displays fine, it just has no
    // enforced floor, same as a tier with no serviceKey at all.
    serviceKey: { type: String, trim: true },
    desc: { type: String, required: true, trim: true },
    features: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Pricing", pricingSchema);
