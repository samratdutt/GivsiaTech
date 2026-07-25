import express from "express";
import VisitorSession from "../models/VisitorSession.js";
import VisitorLead from "../models/VisitorLead.js";
import { parseUserAgent } from "../utils/parseUserAgent.js";
import { sendEmail } from "../utils/sendEmail.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { visitorTrackLimiter, visitorSignupLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

const MAX_PAGES = 50;

// @route   POST /api/visitors/track
// @desc    Public: record/update an anonymous visitor session. Only ever
//          called from the frontend after the visitor has explicitly opted
//          into analytics cookies (see CookieConsent.jsx + VisitorTracker.jsx)
//          — no name/email/phone here, just pages viewed, referrer, and
//          device/browser/IP, the same "basic analytics" the cookie banner
//          discloses. IP is used here the same way it already is for
//          security logging elsewhere (ipBlocklist.js, activityLogger.js).
router.post("/track", visitorTrackLimiter, asyncHandler(async (req, res) => {
  const { sessionId, path, referrer } = req.body;
  if (!sessionId || typeof sessionId !== "string" || sessionId.length > 100) {
    return res.status(400).json({ message: "sessionId is required" });
  }

  const ua = req.headers["user-agent"] || "";
  const { browser, os, deviceType } = parseUserAgent(ua);

  const update = {
    $set: { ip: req.ip, userAgent: ua, browser, os, deviceType, lastSeen: new Date() },
    $setOnInsert: { firstSeen: new Date(), referrer: referrer || "direct" },
    $inc: { visitCount: 1 },
  };
  if (path && typeof path === "string") {
    update.$push = { pages: { $each: [path.slice(0, 200)], $slice: -MAX_PAGES } };
  }

  await VisitorSession.findOneAndUpdate({ sessionId }, update, { upsert: true });
  res.status(204).end();
}));

// @route   POST /api/visitors/signup
// @desc    Public: explicit opt-in — "send me info about your services".
//          A separate, clearly-labeled action from cookie consent (see
//          CookieConsent.jsx's "optin" step) — only visitors who submit
//          this form end up with a phone/email on file, and this is the
//          only place an unsolicited-looking first email gets sent,
//          because they just asked for it.
router.post("/signup", visitorSignupLimiter, asyncHandler(async (req, res) => {
  const { name, email, phone, sessionId } = req.body;
  if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "A valid email is required" });
  }

  const lead = await VisitorLead.create({
    name: typeof name === "string" ? name.trim().slice(0, 100) : undefined,
    email: email.trim().toLowerCase(),
    phone: typeof phone === "string" ? phone.trim().slice(0, 30) : undefined,
    sessionId: typeof sessionId === "string" ? sessionId.slice(0, 100) : undefined,
  });

  const result = await sendEmail({
    to: lead.email,
    subject: "Thanks for your interest in GivsiaTech",
    text: `Hi${lead.name ? ` ${lead.name}` : ""},\n\nThanks for asking to hear more from GivsiaTech. We build production websites, AI automation, SaaS platforms, and mobile apps.\n\nSee what we offer: ${process.env.CLIENT_URL}/#services\nCurrent pricing: ${process.env.CLIENT_URL}/#pricing\nOur work: ${process.env.CLIENT_URL}/#work\n\nWant a quote or have a project in mind? Just reply to this email or use the contact form on the site.\n\n(You're getting this because you asked for it on our site — we won't email you again unless you reach out first.)`,
  });
  if (result.delivered) {
    lead.emailedAt = new Date();
    await lead.save();
  }

  res.status(201).json({ message: "Thanks — check your inbox!" });
}));

// @route   GET /api/visitors
// @desc    Admin: recent visitor sessions (analytics), most recently active first.
router.get("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const sessions = await VisitorSession.find().sort({ lastSeen: -1 }).limit(300);
  res.json({ sessions });
}));

// @route   GET /api/visitors/leads
// @desc    Admin: visitors who explicitly opted in to receive service updates.
router.get("/leads", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const leads = await VisitorLead.find().sort({ createdAt: -1 }).limit(300);
  res.json({ leads });
}));

// @route   DELETE /api/visitors/leads/:id
// @desc    Admin: remove an opt-in record (e.g. test/junk entries).
router.delete("/leads/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const lead = await VisitorLead.findByIdAndDelete(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  res.json({ message: "Lead deleted" });
}));

// @route   DELETE /api/visitors/:id
// @desc    Admin: remove a visitor session record.
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const session = await VisitorSession.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ message: "Session not found" });
  res.json({ message: "Session deleted" });
}));

export default router;
