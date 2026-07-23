import mongoose from "mongoose";

const progressUpdateSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "cancelled"],
    },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    // Offline projects (added by an admin for a deal made outside the site)
    // may have no linked account at all — manualClient carries their
    // contact info in that case instead.
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () { return this.source !== "offline" || !this.manualClient?.name; },
    },
    manualClient: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      email: { type: String, trim: true },
    },
    source: { type: String, enum: ["online", "offline"], default: "online" },
    service: {
      type: String,
      enum: ["website", "ai-automation", "saas", "app-development", "other"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    techStack: { type: [String], default: [] },
    amount: { type: Number, required: true }, // in INR paise
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "cancelled"],
      default: "pending",
    },
    // Admin-set completion percentage — powers the client-facing progress
    // bar. Independent of `status` since a project can be "in-progress" at
    // any point along 0-100.
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    invoiceNumber: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "failed", "refunded", "refund-pending"],
      default: "unpaid",
    },
    // Set when a client self-cancels a paid order within the 48h window
    // (see paymentRoutes.js /orders/:id/cancel) and a real Razorpay refund
    // is issued. refundStatus mirrors Razorpay's own refund.status
    // ("pending" | "processed" | "failed") — refunds aren't always
    // instant, so /webhook listens for refund.processed to confirm it.
    refundId: { type: String },
    refundStatus: { type: String },
    refundAmount: { type: Number }, // in paise, same unit as amount
    refundedAt: { type: Date },
    progressUpdates: [progressUpdateSchema],

    // Set by admin once the work is done, before the project can be
    // published to the public "Work" section — see paymentRoutes.js
    // publish-details route and portfolioRoutes.js from-order gating.
    image: { type: String, trim: true, maxlength: 500 },
    domain: { type: String, trim: true, maxlength: 255 },
    hostingProvider: { type: String, trim: true, maxlength: 255 },
    domainExpiryDate: { type: Date },
    hostingExpiryDate: { type: Date },
  },
  { timestamps: true }
);

orderSchema.pre("save", function (next) {
  if (!this.invoiceNumber) {
    const stamp = this._id.toString().slice(-6).toUpperCase();
    this.invoiceNumber = `GVT-${new Date().getFullYear()}-${stamp}`;
  }
  next();
});

export default mongoose.model("Order", orderSchema);
