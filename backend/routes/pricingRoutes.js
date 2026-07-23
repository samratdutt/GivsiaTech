import express from "express";
import Pricing from "../models/Pricing.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/pricing
// @desc    Public: list active pricing tiers, in display order
router.get("/", asyncHandler(async (req, res) => {
  const tiers = await Pricing.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ tiers });
}));

// @route   GET /api/pricing/all
// @desc    Admin: list every tier, including inactive ones, for management
router.get("/all", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const tiers = await Pricing.find().sort({ order: 1, createdAt: 1 });
  res.json({ tiers });
}));

// @route   POST /api/pricing
// @desc    Admin: create a new pricing tier
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, price, desc, features, featured, order, basePrice, serviceKey } = req.body;
    if (!name || !price || !desc) {
      return res.status(400).json({ message: "Name, price and description are required" });
    }
    const tier = await Pricing.create({
      name,
      price,
      desc,
      features: Array.isArray(features) ? features : [],
      featured: !!featured,
      order: order ?? 0,
      basePrice: basePrice !== undefined && basePrice !== "" ? Number(basePrice) : undefined,
      serviceKey: serviceKey || undefined,
    });
    res.status(201).json({ tier });
  } catch (err) {
    res.status(500).json({ message: "Could not create pricing tier", error: err.message });
  }
});

// @route   PATCH /api/pricing/:id
// @desc    Admin: update a pricing tier
router.patch("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { name, price, desc, features, featured, order, isActive, basePrice, serviceKey } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (price !== undefined) update.price = price;
  if (desc !== undefined) update.desc = desc;
  if (features !== undefined) update.features = Array.isArray(features) ? features : [];
  if (featured !== undefined) update.featured = !!featured;
  if (order !== undefined) update.order = order;
  if (isActive !== undefined) update.isActive = !!isActive;
  if (basePrice !== undefined) update.basePrice = basePrice === "" ? null : Number(basePrice);
  if (serviceKey !== undefined) update.serviceKey = serviceKey || null;

  const tier = await Pricing.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!tier) return res.status(404).json({ message: "Pricing tier not found" });
  res.json({ tier });
}));

// @route   DELETE /api/pricing/:id
// @desc    Admin: remove a pricing tier
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const tier = await Pricing.findById(req.params.id);
  if (!tier) return res.status(404).json({ message: "Pricing tier not found" });
  await tier.deleteOne();
  res.json({ message: "Pricing tier deleted" });
}));

export default router;
