import express from "express";
import ContactMessage from "../models/ContactMessage.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { sendEmail } from "../utils/sendEmail.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { screenText, isDisposableEmail, logSecurityEvent } from "../utils/security.js";

const router = express.Router();

// @route   POST /api/contact
// @desc    Public - submit the site's contact form. Screened for spam
//          before it's stored: a "malicious" verdict (jailbreak-style
//          text, obvious scam content) is rejected outright; "suspicious"
//          is still accepted (a real lead shouldn't be hard-rejected on a
//          heuristic guess) but flagged for the admin to see in the Leads tab.
router.post("/", async (req, res) => {
  try {
    const { name, email, company, serviceInterest, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ message: "Name, email and message are required" });
    }

    const screen = await screenText(message, "contact form message");
    if (screen.verdict === "malicious") {
      await logSecurityEvent({
        type: "spam_detected",
        severity: "medium",
        ip: req.ip,
        path: req.originalUrl.split("?")[0],
        email,
        detail: `Contact form submission rejected: ${screen.reasons.join("; ") || "flagged malicious"}`,
        meta: screen,
      });
      return res.status(400).json({ message: "This message couldn't be submitted — please contact us by email instead." });
    }

    const flaggedSpam = screen.verdict === "suspicious" || isDisposableEmail(email);
    if (flaggedSpam) {
      await logSecurityEvent({
        type: "spam_detected",
        severity: "low",
        ip: req.ip,
        path: req.originalUrl.split("?")[0],
        email,
        detail: `Contact form submission flagged for review: ${screen.reasons.join("; ") || "disposable email domain"}`,
        meta: screen,
      });
    }

    const entry = await ContactMessage.create({
      name,
      email,
      company,
      serviceInterest,
      message,
      flaggedSpam,
      spamReasons: screen.reasons,
    });

    sendEmail({
      to: process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER,
      subject: `New contact form lead: ${name}`,
      text: `${name} (${email}) — ${serviceInterest}\n\n${message}`,
    });

    res.status(201).json({ message: "Thanks — we'll be in touch soon.", id: entry._id });
  } catch (err) {
    res.status(500).json({ message: "Could not submit message", error: err.message });
  }
});

// @route   POST /api/contact/support
// @desc    Logged-in client: send a support message from their dashboard
//          (e.g. to request a cancellation after the 2-day self-serve
//          window, or ask about an order). Auto-fills name/email from the
//          account and links it so admin sees it's a customer, not a lead.
router.post("/support", protect, asyncHandler(async (req, res) => {
  const { message, relatedOrderId } = req.body;
  if (!message?.trim()) {
    return res.status(400).json({ message: "A message is required" });
  }

  const entry = await ContactMessage.create({
    name: req.user.name,
    email: req.user.email,
    company: req.user.company,
    serviceInterest: "other",
    message: message.trim(),
    client: req.user._id,
    relatedOrder: relatedOrderId || undefined,
  });

  sendEmail({
    to: process.env.ADMIN_NOTIFY_EMAIL || process.env.SMTP_USER,
    subject: `Support message from ${req.user.name}`,
    text: `${req.user.name} (${req.user.email})${relatedOrderId ? ` — re: order ${relatedOrderId}` : ""}\n\n${message}`,
  });

  res.status(201).json({ message: "Message sent — support will get back to you soon.", id: entry._id });
}));

// @route   GET /api/contact
// @desc    Admin - list all contact form leads
router.get("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const messages = await ContactMessage.find()
    .populate("client", "name email")
    .populate("relatedOrder", "title")
    .sort({ createdAt: -1 });
  res.json({ messages });
}));

// @route   PATCH /api/contact/:id/status
// @desc    Admin - mark a lead as contacted/closed
router.patch("/:id/status", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["new", "contacted", "closed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  const entry = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!entry) return res.status(404).json({ message: "Message not found" });
  res.json({ message: entry });
}));

// @route   DELETE /api/contact/:id
// @desc    Admin - permanently remove a contact message/lead
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const entry = await ContactMessage.findById(req.params.id);
  if (!entry) return res.status(404).json({ message: "Message not found" });
  await entry.deleteOne();
  res.json({ message: "Message deleted" });
}));

export default router;
