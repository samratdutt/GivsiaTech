import express from "express";
import Service from "../models/Service.js";
import Pricing from "../models/Pricing.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// Turns a title into a stable, URL/id-safe slug — e.g. "Production Websites
// (3D Visuals)" -> "production-websites-3d-visuals". Collisions (two
// services with titles that slugify the same) get a numeric suffix.
async function generateKey(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "service";

  let key = base;
  let n = 2;
  while (await Service.exists({ key })) {
    key = `${base}-${n}`;
    n += 1;
  }
  return key;
}

// @route   GET /api/services
// @desc    Public: list active services, in display order
router.get("/", asyncHandler(async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ services });
}));

// @route   GET /api/services/all
// @desc    Admin: list every service, including inactive ones, for management.
//          Each service also carries linkedTierCount — how many Pricing
//          tiers currently link to it (see models/Pricing.js's serviceKey)
//          — so the admin UI can warn before a delete orphans those links.
router.get("/all", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const services = await Service.find().sort({ order: 1, createdAt: 1 });
  const counts = await Pricing.aggregate([
    { $match: { serviceKey: { $ne: null } } },
    { $group: { _id: "$serviceKey", count: { $sum: 1 } } },
  ]);
  const countByKey = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  res.json({ services: services.map((s) => ({ ...s.toObject(), linkedTierCount: countByKey[s.key] || 0 })) });
}));

// @route   POST /api/services
// @desc    Admin: create a new service
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { tag, title, copy, order } = req.body;
    if (!tag || !title || !copy) {
      return res.status(400).json({ message: "Tag, title and copy are required" });
    }
    const key = await generateKey(title);
    const service = await Service.create({ tag, title, copy, key, order: order ?? 0 });
    res.status(201).json({ service });
  } catch (err) {
    res.status(500).json({ message: "Could not create service", error: err.message });
  }
});

// @route   PATCH /api/services/:id
// @desc    Admin: update a service
router.patch("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { tag, title, copy, order, isActive } = req.body;
  const update = {};
  if (tag !== undefined) update.tag = tag;
  if (title !== undefined) update.title = title;
  if (copy !== undefined) update.copy = copy;
  if (order !== undefined) update.order = order;
  if (isActive !== undefined) update.isActive = !!isActive;

  const service = await Service.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!service) return res.status(404).json({ message: "Service not found" });
  res.json({ service });
}));

// @route   DELETE /api/services/:id
// @desc    Admin: remove a service. Any Pricing tier still linked to it
//          (serviceKey === this service's key) gets unlinked in the same
//          request — otherwise the tier would keep pointing at a key that
//          no longer resolves to any real service, showing up as a raw,
//          unrecognizable string in the admin Pricing tab instead of
//          cleanly falling back to "no linked service".
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });
  await service.deleteOne();
  const { modifiedCount } = await Pricing.updateMany({ serviceKey: service.key }, { $unset: { serviceKey: 1 } });
  res.json({ message: "Service deleted", unlinkedTierCount: modifiedCount });
}));

export default router;
