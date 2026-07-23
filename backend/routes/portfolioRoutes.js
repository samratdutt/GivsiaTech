import express from "express";
import Portfolio from "../models/Portfolio.js";
import Order from "../models/Order.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

const SERVICE_TAG = { website: "Website", "ai-automation": "AI Automation", saas: "SaaS", "app-development": "App Development", other: "Custom" };

// @route   GET /api/portfolio
// @desc    Public: list active portfolio items, in display order
router.get("/", asyncHandler(async (req, res) => {
  const items = await Portfolio.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
  res.json({ items });
}));

// @route   GET /api/portfolio/all
// @desc    Admin: list every item, including inactive ones, for management
router.get("/all", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const items = await Portfolio.find().sort({ order: 1, createdAt: 1 });
  res.json({ items });
}));

// @route   POST /api/portfolio
// @desc    Admin: create a new portfolio item
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { title, tag, desc, stack, image, order } = req.body;
    if (!title || !tag || !desc) {
      return res.status(400).json({ message: "Title, tag and description are required" });
    }
    const item = await Portfolio.create({ title, tag, desc, stack, image, order: order ?? 0 });
    res.status(201).json({ item });
  } catch (err) {
    res.status(500).json({ message: "Could not create portfolio item", error: err.message });
  }
});

// @route   PATCH /api/portfolio/:id
// @desc    Admin: update a portfolio item
router.patch("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { title, tag, desc, stack, image, order, isActive } = req.body;
  const update = {};
  if (title !== undefined) update.title = title;
  if (tag !== undefined) update.tag = tag;
  if (desc !== undefined) update.desc = desc;
  if (stack !== undefined) update.stack = stack;
  if (image !== undefined) update.image = image;
  if (order !== undefined) update.order = order;
  if (isActive !== undefined) update.isActive = !!isActive;

  const item = await Portfolio.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!item) return res.status(404).json({ message: "Portfolio item not found" });
  res.json({ item });
}));

// @route   POST /api/portfolio/from-order/:orderId
// @desc    Admin: publish a project (online or offline/manual) to the
//          public "Work" section as a portfolio case study, pre-filled
//          from that order's title/description/tech stack/image. Creates
//          a new Portfolio item — edit it independently afterward via the
//          Portfolio tab if it needs polishing for public display.
//
//          Gated on purpose: the workflow is review -> start -> complete
//          -> add project pic + domain/hosting -> THEN publish, so an
//          order can't go live on the site half-documented.
router.post("/from-order/:orderId", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order) return res.status(404).json({ message: "Order not found" });

  if (order.status !== "completed") {
    return res.status(400).json({ message: "Only completed projects can be published to the Work section" });
  }
  if (!order.image) {
    return res.status(400).json({ message: "Add a project image before publishing" });
  }
  if (!order.domain || !order.hostingProvider) {
    return res.status(400).json({ message: "Add domain and hosting details before publishing" });
  }

  const item = await Portfolio.create({
    title: order.title,
    tag: SERVICE_TAG[order.service] || "Custom",
    desc: order.description || order.title,
    stack: order.techStack.join(", "),
    image: order.image,
    order: 0,
  });

  res.status(201).json({ item });
}));

// @route   DELETE /api/portfolio/:id
// @desc    Admin: remove a portfolio item
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const item = await Portfolio.findById(req.params.id);
  if (!item) return res.status(404).json({ message: "Portfolio item not found" });
  await item.deleteOne();
  res.json({ message: "Portfolio item deleted" });
}));

export default router;
