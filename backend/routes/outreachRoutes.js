import express from "express";
import Outreach from "../models/Outreach.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { outreachLimiter } from "../middleware/rateLimit.js";
import { sendEmail } from "../utils/sendEmail.js";
import { callGeminiWithRetry } from "../utils/gemini.js";
import { buildServiceContext } from "../utils/serviceContext.js";

const router = express.Router();

// Plain-text delimited format instead of JSON mode — keeps this working
// reliably against the free-tier model even if structured-output support
// is flaky for it (see GEMINI_MODEL notes in backend/.env).
function parseDraft(raw) {
  const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
  const messageMatch = raw.match(/MESSAGE:\s*([\s\S]+)/i);
  const message = (messageMatch ? messageMatch[1] : raw).trim();
  return { subject: (subjectMatch ? subjectMatch[1] : "A quick note from GivsiaTech").trim(), message };
}

// @route   POST /api/outreach/generate
// @desc    Admin/service — draft a cold-outreach email via Gemini, grounded
//          in real site data. Returns a draft only — nothing is sent to the
//          recipient until /send is called with the (possibly edited) text.
router.post("/generate", protect, authorize("admin", "service"), outreachLimiter, asyncHandler(async (req, res) => {
  const { recipientName, notes } = req.body;
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: "AI drafting isn't configured — missing GEMINI_API_KEY" });
  }

  const context = await buildServiceContext();
  const prompt = `You are writing a cold outreach email on behalf of GivsiaTech (by Givsia Private Limited), a software studio, to a prospective client${recipientName ? ` named ${recipientName}` : ""}.

${context}

${notes ? `Context about this lead: ${notes}\n` : ""}
Write a short, professional cold email, 120-180 words, with a clear subject line. End with a clear call to action to reply or book a call. Never invent client names, guarantees, or discounts beyond what's given above. Write it naturally — no placeholder brackets like [Name].

Respond in EXACTLY this format and nothing else:
SUBJECT: <subject line>
MESSAGE: <email body>`;

  const apiRes = await callGeminiWithRetry({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 400 },
  });

  if (!apiRes.ok) {
    const errText = await apiRes.text();
    console.error("Gemini outreach draft error:", errText);
    return res.status(502).json({ message: "Could not generate a draft right now" });
  }

  const data = await apiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  if (!raw.trim()) {
    return res.status(502).json({ message: "Got an empty draft back — try again" });
  }

  res.json({ draft: parseDraft(raw) });
}));

// @route   POST /api/outreach/send
// @desc    Admin/service — send a (reviewed/edited) cold email to one
//          recipient, and log the attempt either way.
router.post("/send", protect, authorize("admin", "service"), outreachLimiter, asyncHandler(async (req, res) => {
  const { recipient, recipientName, subject, message } = req.body;
  if (!recipient || !message?.trim()) {
    return res.status(400).json({ message: "recipient and message are required" });
  }

  let delivered = false;
  let error = null;

  try {
    await sendEmail({ to: recipient, subject: subject || "A message from GivsiaTech", text: message });
    delivered = true;
  } catch (err) {
    error = err.message;
  }

  const entry = await Outreach.create({
    recipient,
    recipientName,
    subject,
    message,
    status: delivered ? "sent" : "failed",
    error: delivered ? undefined : error,
    sentBy: req.user._id,
  });

  if (!delivered) {
    return res.status(502).json({ message: error || "Could not deliver the message", outreach: entry });
  }
  res.status(201).json({ message: "Sent", outreach: entry });
}));

// @route   GET /api/outreach
// @desc    Admin/service — outreach history (most recent first)
router.get("/", protect, authorize("admin", "service"), asyncHandler(async (req, res) => {
  const history = await Outreach.find().populate("sentBy", "name email").sort({ createdAt: -1 }).limit(200);
  res.json({ history });
}));

// @route   DELETE /api/outreach/:id
// @desc    Admin can delete any outreach record; a service-role account can
//          only delete its OWN — otherwise one growth-ops account could
//          delete another's send history/audit trail by guessing/iterating
//          IDs, since they share the same role-level permission.
router.delete("/:id", protect, authorize("admin", "service"), asyncHandler(async (req, res) => {
  const entry = await Outreach.findById(req.params.id);
  if (!entry) return res.status(404).json({ message: "Outreach record not found" });
  if (req.user.role !== "admin" && entry.sentBy.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "You can only delete outreach records you sent yourself" });
  }
  await entry.deleteOne();
  res.json({ message: "Outreach record deleted" });
}));

export default router;
