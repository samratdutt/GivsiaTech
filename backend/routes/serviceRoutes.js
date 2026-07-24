import express from "express";
import Service from "../models/Service.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/services
// @desc    Public: list active services, in display order
router.get("/", asyncHandler(async (req, res) => {
  const services = await Service.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ services });
}));

// @route   GET /api/services/all
// @desc    Admin: list every service, including inactive ones, for management
router.get("/all", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const services = await Service.find().sort({ order: 1, createdAt: 1 });
  res.json({ services });
}));

// @route   POST /api/services
// @desc    Admin: create a new service
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { tag, title, copy, order } = req.body;
    if (!tag || !title || !copy) {
      return res.status(400).json({ message: "Tag, title and copy are required" });
    }
    const service = await Service.create({ tag, title, copy, order: order ?? 0 });
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
// @desc    Admin: remove a service
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) return res.status(404).json({ message: "Service not found" });
  await service.deleteOne();
  res.json({ message: "Service deleted" });
}));

export default router;
