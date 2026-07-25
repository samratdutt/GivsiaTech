import express from "express";
import crypto from "crypto";
import Razorpay from "razorpay";
import { timingSafeEqual } from "../utils/safeCompare.js";
import Order from "../models/Order.js";
import Pricing from "../models/Pricing.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { sendEmail } from "../utils/sendEmail.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { generateInvoicePdf } from "../utils/generateInvoicePdf.js";

const router = express.Router();

const getRazorpayClient = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

// Shared by the client's self-cancel flow below (auto-refunds within the
// 48h window) and the admin's manual /orders/:id/refund route further down
// (for anything outside that window, or any other case a refund needs a
// human decision) — keeps both flows' Razorpay call, error handling, and
// Order-field updates in exact sync instead of drifting apart over time.
// Throws on a Razorpay-side failure; callers decide how to respond to that.
async function issueRefund(order, reasonNote) {
  const rzpClient = getRazorpayClient();
  const refund = await rzpClient.payments.refund(order.razorpayPaymentId, {
    amount: order.amount, // full refund, in paise — same unit as the original charge
    speed: "optimum", // instant if Razorpay/the bank supports it for this payment, else normal
    notes: { reason: reasonNote, orderId: order._id.toString() },
  });

  order.refundId = refund.id;
  order.refundStatus = refund.status;
  order.refundAmount = refund.amount;
  order.refundedAt = new Date();
  order.paymentStatus = refund.status === "processed" ? "refunded" : "refund-pending";
  return refund;
}

// How far below a tier's listed base price a client can self-select when
// requesting a project — enforced here (the real boundary) as well as
// mirrored in the frontend form (ClientDashboard.jsx) for instant feedback.
// A tier with no basePrice set (or service "other") has no enforced floor.
const PRICE_FLOOR_DISCOUNT = 5000;

// An online order that's never been successfully paid (or whose only
// attempt failed) is a client-side-only draft, not a real project yet — it
// must not appear anywhere in the admin panel (Orders, Renewals,
// Transactions, the Overview dashboard's counts/recent-orders feed) until
// payment actually succeeds. Offline orders (admin-logged deals) always
// qualify — they're marked "paid" by default and were never gated on an
// online checkout in the first place. Reused by every admin-facing order
// query below so all of them agree on the same definition.
export const ADMIN_VISIBLE_ORDER_FILTER = {
  $or: [{ source: "offline" }, { paymentStatus: { $nin: ["unpaid", "failed"] } }],
};

// @route   POST /api/payments/create-order
// @desc    Client creates a service order + a Razorpay order to pay for it
router.post("/create-order", protect, async (req, res) => {
  try {
    const { service, title, description, amount } = req.body; // amount in rupees

    if (!service || !title || !amount) {
      return res.status(400).json({ message: "service, title and amount are required" });
    }
    // Independent of any tier floor below — no service should ever accept a
    // zero, negative, or non-numeric amount, regardless of what tier (if
    // any) it matches. Razorpay would likely reject a negative amount on
    // its own, but that's not a business-logic guarantee we control.
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const tier = await Pricing.findOne({ serviceKey: service, isActive: true });
    if (tier?.basePrice) {
      const floor = tier.basePrice - PRICE_FLOOR_DISCOUNT;
      if (amount < floor) {
        return res.status(400).json({
          message: `The amount for ${tier.name} can't be lower than ₹${floor.toLocaleString("en-IN")} (up to ₹${PRICE_FLOOR_DISCOUNT.toLocaleString("en-IN")} below the ₹${tier.basePrice.toLocaleString("en-IN")} starting price).`,
        });
      }
    }

    const amountInPaise = Math.round(amount * 100);

    const order = await Order.create({
      client: req.user._id,
      service,
      title,
      description,
      amount: amountInPaise,
    });

    const rzpClient = getRazorpayClient();
    const rzpOrder = await rzpClient.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: order._id.toString(),
    });

    order.razorpayOrderId = rzpOrder.id;
    await order.save();

    res.status(201).json({
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not create payment order", error: err.message });
  }
});

// @route   POST /api/payments/orders/:id/retry
// @desc    Client: re-attempt payment on their own existing unpaid/failed
//          order — reuses the same Order record with a fresh Razorpay order
//          (the original one may already be stale/attempted), instead of
//          the client having to re-submit the request-project form and end
//          up with a duplicate. The order stays invisible to admin (see
//          ADMIN_VISIBLE_ORDER_FILTER) until this succeeds.
router.post("/orders/:id/retry", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!order.client || order.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to pay for this project" });
    }
    if (!["unpaid", "failed"].includes(order.paymentStatus)) {
      return res.status(400).json({ message: "This project has already been paid for" });
    }
    if (order.status === "cancelled") {
      return res.status(400).json({ message: "This project was cancelled — request a new one instead" });
    }

    const rzpClient = getRazorpayClient();
    const rzpOrder = await rzpClient.orders.create({
      amount: order.amount,
      currency: order.currency || "INR",
      receipt: order._id.toString(),
    });

    order.razorpayOrderId = rzpOrder.id;
    order.paymentStatus = "unpaid";
    await order.save();

    res.json({
      orderId: order._id,
      razorpayOrderId: rzpOrder.id,
      amount: order.amount,
      currency: order.currency || "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not restart payment", error: err.message });
  }
});

// @route   PATCH /api/payments/orders/:id/mark-failed
// @desc    Client: record that their own checkout attempt failed (called
//          from the frontend's Razorpay `payment.failed` handler). Only
//          moves unpaid -> failed — never overwrites an order some other
//          request already marked paid in the meantime.
router.patch("/orders/:id/mark-failed", protect, asyncHandler(async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, client: req.user._id, paymentStatus: "unpaid" },
    { paymentStatus: "failed" },
    { new: true }
  );
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json({ order });
}));

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment signature after checkout completes on the frontend
router.post("/verify", protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (!timingSafeEqual(expectedSignature, razorpay_signature)) {
      return res.status(400).json({ message: "Payment verification failed - signature mismatch" });
    }

    // Scoped to the caller's own order — this is always called by the
    // client right after their own checkout completes, so a different
    // authenticated user's (order_id, payment_id, signature) triple
    // (however they came by it) can't be replayed to flip someone else's
    // order to "paid" under a session that isn't theirs.
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, client: req.user._id },
      { paymentStatus: "paid", razorpayPaymentId: razorpay_payment_id, status: "in-progress" },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found for this payment" });
    }

    res.json({ message: "Payment verified", order });
  } catch (err) {
    res.status(500).json({ message: "Verification failed", error: err.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Razorpay server-to-server webhook (configure in Razorpay dashboard).
//          Mount this route with express.raw() in server.js, NOT express.json().
router.post("/webhook", asyncHandler(async (req, res) => {
  const webhookSignature = req.headers["x-razorpay-signature"];
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
    .update(req.body) // raw buffer
    .digest("hex");

  if (!timingSafeEqual(webhookSignature, expected)) {
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  const event = JSON.parse(req.body.toString());

  if (event.event === "payment.captured") {
    const rzpOrderId = event.payload.payment.entity.order_id;
    await Order.findOneAndUpdate(
      { razorpayOrderId: rzpOrderId },
      { paymentStatus: "paid", status: "in-progress" }
    );
  }

  // Server-to-server backstop for the frontend's payment.failed handler
  // (see /orders/:id/mark-failed) — catches a declined payment even if the
  // client's browser closed/crashed before it could call that route itself.
  // Only touches an order still "unpaid" so it can never clobber a payment
  // that a near-simultaneous payment.captured already marked "paid".
  if (event.event === "payment.failed") {
    const rzpOrderId = event.payload.payment.entity.order_id;
    await Order.findOneAndUpdate(
      { razorpayOrderId: rzpOrderId, paymentStatus: "unpaid" },
      { paymentStatus: "failed" }
    );
  }

  // Refunds aren't always instant — /orders/:id/cancel below already sets
  // paymentStatus to "refund-pending" (or "refunded" if Razorpay confirmed
  // it synchronously) the moment a refund is issued. This event is the
  // async confirmation once Razorpay actually finishes processing it,
  // independent of whether the browser that requested the cancellation is
  // still open.
  if (event.event === "refund.processed") {
    const refundEntity = event.payload.refund.entity;
    await Order.findOneAndUpdate(
      { refundId: refundEntity.id },
      { paymentStatus: "refunded", refundStatus: "processed" }
    );
  }

  res.status(200).json({ received: true });
}));

// @route   GET /api/payments/orders
// @desc    Admin: view all orders that have actually been paid for (see
//          ADMIN_VISIBLE_ORDER_FILTER). Client: view every one of their own
//          orders regardless of payment status — an unpaid/failed one is
//          exactly what they need to see so they can retry it.
router.get("/orders", protect, asyncHandler(async (req, res) => {
  const filter = req.user.role === "client" ? { client: req.user._id } : ADMIN_VISIBLE_ORDER_FILTER;
  const orders = await Order.find(filter)
    .populate("client", "name email company")
    .sort({ createdAt: -1 });
  res.json({ orders });
}));

// @route   GET /api/payments/orders/:id
// @desc    Full detail for a single order, including its progress timeline.
//          Clients can only fetch their own order; admins can fetch any.
router.get("/orders/:id", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("client", "name email company")
    .populate("progressUpdates.postedBy", "name role");

  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.client?._id?.toString() === req.user._id.toString();
  if (req.user.role === "client" && !isOwner) {
    return res.status(403).json({ message: "Not authorized to view this order" });
  }

  res.json({ order });
}));

// @route   GET /api/payments/orders/:id/invoice
// @desc    Download a PDF invoice — only once an order has actually been
//          paid (or paid-then-refunded; the PDF still reflects what was
//          genuinely charged, with the refund noted separately rather than
//          rewriting history). Same ownership rule as the detail route above.
router.get("/orders/:id/invoice", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("client", "name email company");
  if (!order) return res.status(404).json({ message: "Order not found" });

  const isOwner = order.client?._id?.toString() === req.user._id.toString();
  if (req.user.role === "client" && !isOwner) {
    return res.status(403).json({ message: "Not authorized to view this invoice" });
  }
  if (!["paid", "refunded", "refund-pending"].includes(order.paymentStatus)) {
    return res.status(400).json({ message: "An invoice is only available once a payment has been made" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="GivsiaTech-Invoice-${order.invoiceNumber}.pdf"`);
  generateInvoicePdf(order, res);
}));

// @route   POST /api/payments/orders/:id/progress
// @desc    Admin: post a progress update on an order's timeline.
//          Optionally also updates the order's overall status and/or
//          completion percentage. This is what powers the client-facing
//          project status view and progress bar.
router.post("/orders/:id/progress", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { note, status, progressPercent } = req.body;
  if (!note) return res.status(400).json({ message: "A note is required" });
  if (status && !["pending", "in-progress", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  if (progressPercent !== undefined && (progressPercent < 0 || progressPercent > 100)) {
    return res.status(400).json({ message: "Progress percent must be between 0 and 100" });
  }

  const order = await Order.findById(req.params.id).populate("client", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  order.progressUpdates.push({ note, status, postedBy: req.user._id });
  if (status) order.status = status;
  if (progressPercent !== undefined) order.progressPercent = progressPercent;
  else if (status === "completed") order.progressPercent = 100; // completed always reads as 100% even if no explicit percent was given
  await order.save();

  sendEmail({
    to: order.client?.email,
    subject: `Update on your project: ${order.title}`,
    text: `${note}${status ? `\n\nStatus: ${status}` : ""}`,
  });

  res.status(201).json({ order });
}));

const CANCEL_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

// @route   PATCH /api/payments/orders/:id/cancel
// @desc    Client: cancel their own project, but only within 2 days of
//          requesting it. After that window they're pointed to support
//          instead — self-serve cancellation stays blocked at the API
//          level regardless of what the frontend allows.
router.patch("/orders/:id/cancel", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (!order.client || order.client.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Not authorized to cancel this project" });
  }
  if (["completed", "cancelled"].includes(order.status)) {
    return res.status(400).json({ message: `This project is already ${order.status} and can't be cancelled` });
  }
  if (Date.now() - order.createdAt.getTime() > CANCEL_WINDOW_MS) {
    return res.status(400).json({
      message: "The 2-day self-cancellation window has passed. Please contact support to request a cancellation.",
    });
  }

  // If money already changed hands, issue a real refund before touching
  // anything else — if Razorpay's API call fails, the order is left exactly
  // as it was (still "in-progress", not cancelled) instead of telling the
  // client "cancelled" while secretly having no refund behind it. That kind
  // of silent gap is worse than the cancel button failing outright and
  // pointing them at support.
  let refund = null;
  if (order.paymentStatus === "paid") {
    try {
      refund = await issueRefund(order, "Client self-cancelled within the 48-hour window");
    } catch (err) {
      return res.status(502).json({
        message: "Could not process your refund automatically — please contact support and we'll sort it out manually.",
        error: err.error?.description || err.message,
      });
    }
  }

  order.status = "cancelled";
  order.progressUpdates.push({
    note: refund ? `Cancelled by client — refund of ${(refund.amount / 100).toLocaleString("en-IN")} INR initiated` : "Cancelled by client",
    status: "cancelled",
    postedBy: req.user._id,
  });
  await order.save();

  sendEmail({
    to: req.user.email,
    subject: `Your project "${order.title}" was cancelled`,
    text: refund
      ? `Your project has been cancelled and a refund of Rs. ${(refund.amount / 100).toLocaleString("en-IN")} has been initiated to your original payment method. It can take a few business days to reflect, depending on your bank.`
      : `Your project has been cancelled as requested.`,
  });

  res.json({ order, refund });
}));

// @route   POST /api/payments/orders/:id/refund
// @desc    Admin: manually issue a Razorpay refund for a cancelled project.
//          Covers whatever the client's own self-cancel flow above doesn't
//          — outside the 48h window, or any other case a refund needs a
//          human decision. Only usable once the project is actually
//          cancelled (regardless of who cancelled it), and only once, on a
//          paid order — the admin Orders tab's Refund button follows this
//          exact gate so it's disabled everywhere this would 400.
router.post("/orders/:id/refund", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate("client", "name email");
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.status !== "cancelled") {
    return res.status(400).json({ message: "Only a cancelled project can be refunded" });
  }
  if (order.paymentStatus !== "paid") {
    return res.status(400).json({
      message: ["unpaid", "failed"].includes(order.paymentStatus)
        ? "This project was never paid for — nothing to refund"
        : "This project has already been refunded",
    });
  }
  if (!order.razorpayPaymentId) {
    return res.status(400).json({ message: "No Razorpay payment is on record for this project" });
  }

  let refund;
  try {
    refund = await issueRefund(order, "Refunded by admin after cancellation");
  } catch (err) {
    return res.status(502).json({
      message: "Razorpay refund failed — please check the payment directly in the Razorpay dashboard",
      error: err.error?.description || err.message,
    });
  }

  order.progressUpdates.push({
    note: `Refund of ${(refund.amount / 100).toLocaleString("en-IN")} INR issued by admin`,
    postedBy: req.user._id,
  });
  await order.save();

  sendEmail({
    to: order.client?.email,
    subject: `Your project "${order.title}" has been refunded`,
    text: `A refund of Rs. ${(refund.amount / 100).toLocaleString("en-IN")} has been initiated to your original payment method for "${order.title}". It can take a few business days to reflect, depending on your bank.`,
  });

  res.json({ order, refund });
}));

// @route   POST /api/payments/orders/manual
// @desc    Admin: manually log a project — for deals made offline (phone,
//          in person, etc.) as well as recording full project detail
//          (description, tech stack) for an existing online order. If the
//          client already has an account, link it via clientId; otherwise
//          pass manualClientName/Phone/Email for a walk-in with no account.
router.post("/orders/manual", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const {
    clientId,
    manualClientName,
    manualClientPhone,
    manualClientEmail,
    service,
    title,
    description,
    techStack,
    amount,
    status,
    progressPercent,
    paymentStatus,
    image,
  } = req.body;

  if (!title || !amount) {
    return res.status(400).json({ message: "Title and amount are required" });
  }
  if (!clientId && !manualClientName) {
    return res.status(400).json({ message: "Either an existing client or a manual client name is required" });
  }

  const order = await Order.create({
    client: clientId || undefined,
    manualClient: clientId ? undefined : { name: manualClientName, phone: manualClientPhone, email: manualClientEmail },
    source: "offline",
    service: service || "other",
    title,
    description,
    techStack: Array.isArray(techStack) ? techStack : [],
    amount: Math.round(Number(amount) * 100),
    status: status || "completed",
    progressPercent: progressPercent ?? (status === "completed" || !status ? 100 : 0),
    paymentStatus: paymentStatus || "paid",
    image: image || undefined,
  });

  res.status(201).json({ order });
}));

// @route   DELETE /api/payments/orders/:id
// @desc    Admin or the owning client: permanently remove a project, but
//          only once it's cancelled — for admin this used to be
//          unconditional, now it isn't: a project that's still
//          pending/in-progress/completed is a real (or once-real) piece of
//          work with an invoice and progress history someone may rely on,
//          so deleting it is only ever safe once it's been cancelled first
//          (regardless of who cancelled it). Deleting removes the one
//          underlying record, so it disappears from both the admin panel
//          and the client's own dashboard at once — there's no separate
//          per-view copy to clean up.
router.delete("/orders/:id", protect, asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (req.user.role !== "admin") {
    const isOwner = order.client?.toString() === req.user._id.toString();
    if (!isOwner) return res.status(403).json({ message: "Not authorized to delete this project" });
  }
  if (order.status !== "cancelled") {
    return res.status(400).json({ message: "Only a cancelled project can be deleted" });
  }

  await order.deleteOne();
  res.json({ message: "Order deleted" });
}));

// @route   PATCH /api/payments/orders/:id/status
// @desc    Admin: update an order's progress status
router.patch("/orders/:id/status", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "in-progress", "completed", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json({ order });
}));

// @route   PATCH /api/payments/orders/:id/publish-details
// @desc    Admin: record the project image and domain/hosting info once
//          work is done — required before the project can be published to
//          the public Work section (see portfolioRoutes.js from-order),
//          and doubles as renewal-monitoring data in the admin dashboard.
router.patch("/orders/:id/publish-details", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { image, domain, hostingProvider, domainExpiryDate, hostingExpiryDate } = req.body;
  const update = {};
  if (image !== undefined) update.image = image;
  if (domain !== undefined) update.domain = domain;
  if (hostingProvider !== undefined) update.hostingProvider = hostingProvider;
  if (domainExpiryDate !== undefined) update.domainExpiryDate = domainExpiryDate || null;
  if (hostingExpiryDate !== undefined) update.hostingExpiryDate = hostingExpiryDate || null;

  const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json({ order });
}));

export default router;
