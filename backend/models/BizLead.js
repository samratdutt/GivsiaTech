import mongoose from "mongoose";

export const BIZ_LEAD_CATEGORIES = [
  "restaurants-cafes",
  "photography-studios",
  "dental-clinics",
  "medical-clinics",
  "gyms-fitness",
  "car-service-centers",
  "taxi-cab-services",
  "beauty-salons",
  "cosmetic-clinics",
  "boutiques",
  "travel-agencies",
  "tourism-agencies",
  "event-management",
  "digital-marketing-agencies",
  "real-estate-agencies",
  "educational-institutes",
  "coaching-centers",
  "hotels-resorts",
  "interior-designers",
  "architects",
  "pet-clinics",
  "veterinary-hospitals",
  "furniture-stores",
  "electronics-stores",
  "automobile-dealers",
  "local-retail",
  "other",
];

export const BIZ_LEAD_STATUSES = [
  "new",
  "contacted",
  "follow-up",
  "meeting",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "do-not-contact",
];

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["created", "status-change", "note", "email-sent", "call", "meeting", "assigned", "imported", "discovered"],
      required: true,
    },
    detail: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
  },
  { timestamps: true }
);

const bizLeadSchema = new mongoose.Schema(
  {
    // "lead-finder" = Module 1 (AI Business Lead Finder), "new-business" =
    // Module 2 (New Business Monitor). Same CRM engine underneath — kept as
    // one collection so status workflow, notes, and outreach are shared,
    // filtered apart by this field everywhere it matters.
    moduleType: { type: String, enum: ["lead-finder", "new-business"], default: "lead-finder", index: true },

    businessName: { type: String, required: true, trim: true },
    category: { type: String, enum: BIZ_LEAD_CATEGORIES, default: "other", index: true },
    ownerName: { type: String, trim: true },
    phones: [{ type: String, trim: true }],
    email: { type: String, trim: true, lowercase: true },

    address: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    state: { type: String, trim: true, index: true },
    country: { type: String, trim: true, index: true, default: "India" },
    postalCode: { type: String, trim: true },

    googleMapsLink: { type: String, trim: true },
    googlePlaceId: { type: String, trim: true, unique: true, sparse: true },
    rating: { type: Number, min: 0, max: 5 },
    reviewCount: { type: Number, min: 0, default: 0 },

    websiteStatus: { type: String, enum: ["no-website", "exists", "broken"], default: "no-website", index: true },
    websiteUrl: { type: String, trim: true },
    socialLinks: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      twitter: { type: String, trim: true },
      other: { type: String, trim: true },
    },
    description: { type: String, trim: true },
    images: [{ type: String, trim: true }],

    // 0-100 — for lead-finder: how confident the discovery signal is that
    // this business truly lacks a website (heuristic from Places data, see
    // utils/googlePlaces.js). For manual/CSV entries this defaults to a
    // neutral value since there's no discovery signal behind it.
    aiConfidenceScore: { type: Number, min: 0, max: 100, default: 50 },
    // 0-100 — how good a sales prospect this business is, from the same
    // observable signals (no website, low review count relative to rating,
    // etc). Deliberately built only from things we can actually measure —
    // no fabricated "no branding"/"weak SEO" signals we have no data for.
    opportunityScore: { type: Number, min: 0, max: 100, default: 50 },

    businessSize: { type: String, enum: ["small", "medium", "large"], default: "small" },
    source: { type: String, enum: ["places-api", "csv-import", "manual"], default: "manual" },

    // Module 2 (new-business) specific fields — left empty for lead-finder.
    registrationDate: { type: Date },
    registrationNumber: { type: String, trim: true },
    directors: [{ type: String, trim: true }],

    leadStatus: { type: String, enum: BIZ_LEAD_STATUSES, default: "new", index: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    tags: [{ type: String, trim: true }],
    nextFollowUpAt: { type: Date },

    isDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: "BizLead", default: null },

    notes: [noteSchema],
    activityLog: [activitySchema],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

bizLeadSchema.index({ businessName: "text", description: "text", ownerName: "text" });
bizLeadSchema.index({ moduleType: 1, leadStatus: 1, createdAt: -1 });

export default mongoose.model("BizLead", bizLeadSchema);
