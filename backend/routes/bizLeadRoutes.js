import express from "express";
import multer from "multer";
import BizLead, { BIZ_LEAD_CATEGORIES, BIZ_LEAD_STATUSES } from "../models/BizLead.js";
import EmailTemplate from "../models/EmailTemplate.js";
import Outreach from "../models/Outreach.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { bizLeadLimiter, bizLeadDiscoverLimiter } from "../middleware/rateLimit.js";
import { discoverBusinesses, isPlacesConfigured } from "../utils/googlePlaces.js";
import { parseLeadsCsv, leadsToCsv } from "../utils/bizLeadCsv.js";
import { callGeminiWithRetry } from "../utils/gemini.js";
import { buildServiceContext } from "../utils/serviceContext.js";
import { sendEmail } from "../utils/sendEmail.js";
import PDFDocument from "pdfkit";

const router = express.Router();
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /csv|text\/plain/i.test(file.mimetype) || file.originalname.toLowerCase().endsWith(".csv");
    cb(ok ? null : new Error("Only .csv files are accepted"), ok);
  },
});

// Everything in this module is admin-only, per the spec framing this as an
// Admin Dashboard tool — sales reps/service accounts aren't given access in
// this pass.
router.use(protect, authorize("admin"), bizLeadLimiter);

function buildFilter(query) {
  const filter = {};
  if (query.moduleType) filter.moduleType = query.moduleType;
  if (query.category) filter.category = query.category;
  if (query.country) filter.country = new RegExp(`^${escapeRegex(query.country)}$`, "i");
  if (query.state) filter.state = new RegExp(`^${escapeRegex(query.state)}$`, "i");
  if (query.city) filter.city = new RegExp(`^${escapeRegex(query.city)}$`, "i");
  if (query.websiteStatus) filter.websiteStatus = query.websiteStatus;
  if (query.leadStatus) filter.leadStatus = query.leadStatus;
  if (query.businessSize) filter.businessSize = query.businessSize;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.minRating) filter.rating = { $gte: Number(query.minRating) };
  if (query.minConfidence) filter.aiConfidenceScore = { $gte: Number(query.minConfidence) };
  if (query.hasEmail === "true") filter.email = { $nin: [null, ""] };
  if (query.hasContact === "true") filter.phones = { $exists: true, $ne: [] };
  if (query.recentDays) {
    const since = new Date(Date.now() - Number(query.recentDays) * 24 * 60 * 60 * 1000);
    filter.createdAt = { $gte: since };
  }
  if (query.search) filter.$text = { $search: query.search };
  return filter;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// @route   GET /api/bizleads
router.get("/", asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 25);

  const [leads, total] = await Promise.all([
    BizLead.find(filter)
      .populate("assignedTo", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    BizLead.countDocuments(filter),
  ]);

  res.json({ leads, total, page, pages: Math.ceil(total / limit) || 1 });
}));

// @route   GET /api/bizleads/analytics
router.get("/analytics", asyncHandler(async (req, res) => {
  const base = req.query.moduleType ? { moduleType: req.query.moduleType } : {};
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    total, newToday, byCategory, byCity, byCountry,
    contacted, won, lost, followUpsDue,
  ] = await Promise.all([
    BizLead.countDocuments(base),
    BizLead.countDocuments({ ...base, createdAt: { $gte: startOfToday } }),
    BizLead.aggregate([{ $match: base }, { $group: { _id: "$category", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    BizLead.aggregate([{ $match: base }, { $group: { _id: "$city", count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]),
    BizLead.aggregate([{ $match: base }, { $group: { _id: "$country", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    BizLead.countDocuments({ ...base, leadStatus: { $in: ["contacted", "follow-up", "meeting", "proposal", "negotiation"] } }),
    BizLead.countDocuments({ ...base, leadStatus: "won" }),
    BizLead.countDocuments({ ...base, leadStatus: "lost" }),
    BizLead.countDocuments({ ...base, nextFollowUpAt: { $lte: new Date() }, leadStatus: { $nin: ["won", "lost", "do-not-contact"] } }),
  ]);

  const decided = won + lost;
  res.json({
    total, newToday, byCategory, byCity, byCountry,
    contacted, won, lost, followUpsDue,
    pending: total - contacted - won - lost,
    conversionRate: decided ? Math.round((won / decided) * 1000) / 10 : 0,
  });
}));

// @route   GET /api/bizleads/export?format=csv|pdf
router.get("/export", asyncHandler(async (req, res) => {
  const filter = buildFilter(req.query);
  const leads = await BizLead.find(filter).sort({ createdAt: -1 }).limit(5000);

  if (req.query.format === "pdf") {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=leads.pdf");
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    doc.pipe(res);
    doc.fontSize(14).text("GivsiaTech — Business Leads Export", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(8);
    leads.forEach((l) => {
      doc.text(
        `${l.businessName} | ${l.category} | ${l.city || "-"}, ${l.state || "-"}, ${l.country || "-"} | ` +
        `${(l.phones || []).join(", ") || "-"} | ${l.email || "-"} | ${l.websiteStatus} | ${l.leadStatus} | rating ${l.rating ?? "-"}`
      );
    });
    doc.end();
    return;
  }

  const csv = leadsToCsv(leads);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.send(csv);
}));

// ---- Email templates (declared before /:id so "templates" isn't parsed as an id) ----

router.get("/templates", asyncHandler(async (req, res) => {
  const templates = await EmailTemplate.find().sort({ createdAt: -1 });
  res.json({ templates });
}));

router.post("/templates", asyncHandler(async (req, res) => {
  const { name, subject, body, category } = req.body;
  if (!name || !subject || !body) return res.status(400).json({ message: "name, subject, and body are required" });
  const template = await EmailTemplate.create({ name, subject, body, category, createdBy: req.user._id });
  res.status(201).json({ template });
}));

router.patch("/templates/:id", asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  ["name", "subject", "body", "category"].forEach((f) => {
    if (req.body[f] !== undefined) template[f] = req.body[f];
  });
  await template.save();
  res.json({ template });
}));

router.delete("/templates/:id", asyncHandler(async (req, res) => {
  const template = await EmailTemplate.findById(req.params.id);
  if (!template) return res.status(404).json({ message: "Template not found" });
  await template.deleteOne();
  res.json({ message: "Template deleted" });
}));

// @route   POST /api/bizleads/discover
// @desc    Google Places-driven discovery for one category + city/state/country.
router.post("/discover", bizLeadDiscoverLimiter, asyncHandler(async (req, res) => {
  if (!isPlacesConfigured()) {
    return res.status(503).json({ message: "Business discovery isn't configured — missing GOOGLE_PLACES_API_KEY" });
  }
  const { category, city, state, country, moduleType } = req.body;
  if (!category || !city) return res.status(400).json({ message: "category and city are required" });
  if (!BIZ_LEAD_CATEGORIES.includes(category)) return res.status(400).json({ message: "Unknown category" });

  let result;
  try {
    result = await discoverBusinesses({ category, city, state, country });
  } catch (err) {
    return res.status(502).json({ message: err.message || "Discovery failed" });
  }

  let createdCount = 0;
  let skippedDuplicate = 0;
  for (const record of result.records) {
    const exists = await BizLead.findOne({ googlePlaceId: record.googlePlaceId });
    if (exists) {
      skippedDuplicate += 1;
      continue;
    }
    await BizLead.create({
      ...record,
      moduleType: moduleType === "new-business" ? "new-business" : "lead-finder",
      createdBy: req.user._id,
      activityLog: [{ type: "discovered", detail: "Discovered via Google Places API", createdBy: req.user._id, createdByName: req.user.name }],
    });
    createdCount += 1;
  }

  res.status(201).json({
    created: createdCount,
    skippedDuplicate,
    skippedHasWebsite: result.skippedHasWebsite,
    totalFound: result.totalFound,
  });
}));

// @route   POST /api/bizleads/import-csv
router.post("/import-csv", csvUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No CSV file received" });

  let rows;
  try {
    rows = parseLeadsCsv(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ message: `Could not parse CSV: ${err.message}` });
  }
  if (rows.length > 5000) return res.status(400).json({ message: "CSV has too many rows (max 5000 per import)" });

  const moduleType = req.body.moduleType === "new-business" ? "new-business" : "lead-finder";
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (const [i, row] of rows.entries()) {
    if (!row.businessName?.trim()) {
      skipped += 1;
      continue;
    }
    const duplicateQuery = {
      moduleType,
      businessName: new RegExp(`^${escapeRegex(row.businessName.trim())}$`, "i"),
      city: row.city ? new RegExp(`^${escapeRegex(row.city.trim())}$`, "i") : undefined,
    };
    const existing = await BizLead.findOne(duplicateQuery);
    if (existing) {
      skipped += 1;
      continue;
    }

    try {
      await BizLead.create({
        moduleType,
        businessName: row.businessName.trim(),
        category: BIZ_LEAD_CATEGORIES.includes(row.category) ? row.category : "other",
        ownerName: row.ownerName,
        phones: row.phone ? row.phone.split(";").map((p) => p.trim()).filter(Boolean) : [],
        email: row.email,
        address: row.address,
        city: row.city,
        state: row.state,
        country: row.country,
        postalCode: row.postalCode,
        googleMapsLink: row.googleMapsLink,
        rating: row.rating ? Number(row.rating) : undefined,
        reviewCount: row.reviewCount ? Number(row.reviewCount) : 0,
        websiteStatus: ["no-website", "exists", "broken"].includes(row.websiteStatus) ? row.websiteStatus : "no-website",
        websiteUrl: row.websiteUrl,
        description: row.description,
        businessSize: ["small", "medium", "large"].includes(row.businessSize) ? row.businessSize : "small",
        leadStatus: BIZ_LEAD_STATUSES.includes(row.leadStatus) ? row.leadStatus : "new",
        registrationDate: row.registrationDate ? new Date(row.registrationDate) : undefined,
        registrationNumber: row.registrationNumber,
        directors: row.directors ? row.directors.split(";").map((d) => d.trim()).filter(Boolean) : [],
        source: "csv-import",
        createdBy: req.user._id,
        activityLog: [{ type: "imported", detail: "Imported via CSV", createdBy: req.user._id, createdByName: req.user.name }],
      });
      created += 1;
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`);
    }
  }

  res.status(201).json({ created, skipped, errors: errors.slice(0, 20) });
}));

// @route   POST /api/bizleads
router.post("/", asyncHandler(async (req, res) => {
  const { businessName, city } = req.body;
  if (!businessName?.trim()) return res.status(400).json({ message: "businessName is required" });

  let isDuplicateOf = null;
  if (city) {
    const existing = await BizLead.findOne({
      businessName: new RegExp(`^${escapeRegex(businessName.trim())}$`, "i"),
      city: new RegExp(`^${escapeRegex(city.trim())}$`, "i"),
    });
    if (existing) isDuplicateOf = existing._id;
  }

  const lead = await BizLead.create({
    ...req.body,
    source: "manual",
    isDuplicateOf,
    createdBy: req.user._id,
    activityLog: [{ type: "created", detail: "Added manually", createdBy: req.user._id, createdByName: req.user.name }],
  });
  res.status(201).json({ lead, possibleDuplicate: Boolean(isDuplicateOf) });
}));

// @route   GET /api/bizleads/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const lead = await BizLead.findById(req.params.id)
    .populate("assignedTo", "name email")
    .populate("notes.createdBy", "name")
    .populate("activityLog.createdBy", "name")
    .populate("isDuplicateOf", "businessName city");
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  const communications = await Outreach.find({ lead: lead._id }).sort({ createdAt: -1 });
  res.json({ lead, communications });
}));

const EDITABLE_FIELDS = [
  "businessName", "category", "ownerName", "phones", "email",
  "address", "city", "state", "country", "postalCode",
  "googleMapsLink", "rating", "reviewCount", "websiteStatus", "websiteUrl",
  "socialLinks", "description", "images", "businessSize",
  "leadStatus", "assignedTo", "tags", "nextFollowUpAt",
  "registrationDate", "registrationNumber", "directors",
];

// @route   PATCH /api/bizleads/:id
router.patch("/:id", asyncHandler(async (req, res) => {
  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  const previousStatus = lead.leadStatus;
  const previousAssignee = lead.assignedTo?.toString();

  EDITABLE_FIELDS.forEach((f) => {
    if (req.body[f] !== undefined) lead[f] = req.body[f];
  });

  if (req.body.leadStatus && req.body.leadStatus !== previousStatus) {
    lead.activityLog.push({
      type: "status-change",
      detail: `${previousStatus} → ${req.body.leadStatus}`,
      createdBy: req.user._id,
      createdByName: req.user.name,
    });
  }
  if (req.body.assignedTo !== undefined && req.body.assignedTo !== previousAssignee) {
    lead.activityLog.push({
      type: "assigned",
      detail: "Reassigned lead",
      createdBy: req.user._id,
      createdByName: req.user.name,
    });
  }

  await lead.save();
  res.json({ lead });
}));

// @route   DELETE /api/bizleads/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  await lead.deleteOne();
  res.json({ message: "Lead deleted" });
}));

// @route   POST /api/bizleads/:id/notes
router.post("/:id/notes", asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ message: "Note text is required" });
  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  lead.notes.push({ text: text.trim(), createdBy: req.user._id, createdByName: req.user.name });
  lead.activityLog.push({ type: "note", detail: text.trim().slice(0, 120), createdBy: req.user._id, createdByName: req.user.name });
  await lead.save();
  res.status(201).json({ lead });
}));

// @route   POST /api/bizleads/:id/generate-email
router.post("/:id/generate-email", asyncHandler(async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: "AI drafting isn't configured — missing GEMINI_API_KEY" });
  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  const context = await buildServiceContext();
  const prompt = `You are writing a cold outreach email on behalf of GivsiaTech (by Givsia Private Limited), a software studio, to a local business that currently has ${lead.websiteStatus === "no-website" ? "no official website" : "a weak/inactive web presence"}.

${context}

BUSINESS BEING CONTACTED:
- Name: ${lead.businessName}
- Category: ${lead.category}
- Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "unknown"}
- Google rating: ${lead.rating ? `${lead.rating} (${lead.reviewCount} reviews)` : "not available"}
${lead.description ? `- Description: ${lead.description}` : ""}

Write a short, professional cold email, 120-180 words, with a clear subject line, that speaks directly to what a business like this stands to gain from a real website (more customers finding them, credibility, bookings). Never invent facts about this specific business beyond what's given above. No placeholder brackets like [Name].

Respond in EXACTLY this format and nothing else:
SUBJECT: <subject line>
MESSAGE: <email body>`;

  const apiRes = await callGeminiWithRetry({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 400 },
  });
  if (!apiRes.ok) return res.status(502).json({ message: "Could not generate a draft right now" });

  const data = await apiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  if (!raw.trim()) return res.status(502).json({ message: "Got an empty draft back — try again" });

  const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
  const messageMatch = raw.match(/MESSAGE:\s*([\s\S]+)/i);
  res.json({
    draft: {
      subject: (subjectMatch ? subjectMatch[1] : `A quick note for ${lead.businessName}`).trim(),
      message: (messageMatch ? messageMatch[1] : raw).trim(),
    },
  });
}));

// @route   POST /api/bizleads/:id/generate-proposal
router.post("/:id/generate-proposal", asyncHandler(async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ message: "AI drafting isn't configured — missing GEMINI_API_KEY" });
  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });

  const context = await buildServiceContext();
  const prompt = `You are writing a short sales proposal from GivsiaTech (by Givsia Private Limited) for a prospective client business.

${context}

BUSINESS: ${lead.businessName} (${lead.category}), ${[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "location unknown"}.
Current web presence: ${lead.websiteStatus}.

Write a structured proposal (220-320 words) with these sections: "The Opportunity" (what they're missing without a website), "What We'd Build" (tie to the real services/pricing above, pick the most relevant tier), "Why GivsiaTech". Do not invent a fixed price beyond the published tiers above, and do not invent client names or guarantees. No placeholder brackets.

Respond in EXACTLY this format and nothing else:
SUBJECT: <subject line>
MESSAGE: <proposal body>`;

  const apiRes = await callGeminiWithRetry({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 550 },
  });
  if (!apiRes.ok) return res.status(502).json({ message: "Could not generate a proposal right now" });

  const data = await apiRes.json();
  const raw = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  if (!raw.trim()) return res.status(502).json({ message: "Got an empty draft back — try again" });

  const subjectMatch = raw.match(/SUBJECT:\s*(.+)/i);
  const messageMatch = raw.match(/MESSAGE:\s*([\s\S]+)/i);
  res.json({
    draft: {
      subject: (subjectMatch ? subjectMatch[1] : `A proposal for ${lead.businessName}`).trim(),
      message: (messageMatch ? messageMatch[1] : raw).trim(),
    },
  });
}));

// @route   POST /api/bizleads/:id/send-email
router.post("/:id/send-email", asyncHandler(async (req, res) => {
  const { subject, message } = req.body;
  if (!message?.trim()) return res.status(400).json({ message: "message is required" });

  const lead = await BizLead.findById(req.params.id);
  if (!lead) return res.status(404).json({ message: "Lead not found" });
  if (!lead.email) return res.status(400).json({ message: "This lead has no email address on file" });
  if (lead.leadStatus === "do-not-contact") return res.status(400).json({ message: "This lead is marked Do Not Contact" });

  let delivered = false;
  let error = null;
  try {
    await sendEmail({ to: lead.email, subject: subject || `A message from GivsiaTech`, text: message });
    delivered = true;
  } catch (err) {
    error = err.message;
  }

  await Outreach.create({
    recipient: lead.email,
    recipientName: lead.businessName,
    subject,
    message,
    status: delivered ? "sent" : "failed",
    error: delivered ? undefined : error,
    sentBy: req.user._id,
    lead: lead._id,
  });

  lead.activityLog.push({
    type: "email-sent",
    detail: delivered ? `Email sent: ${subject || "(no subject)"}` : `Email failed: ${error || "unknown error"}`,
    createdBy: req.user._id,
    createdByName: req.user.name,
  });
  if (delivered && lead.leadStatus === "new") lead.leadStatus = "contacted";
  await lead.save();

  if (!delivered) return res.status(502).json({ message: error || "Could not deliver the email" });
  res.status(201).json({ message: "Sent", lead });
}));

router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.message });
  next();
});

export default router;
