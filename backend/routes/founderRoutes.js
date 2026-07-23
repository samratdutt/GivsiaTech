import express from "express";
import Founder from "../models/Founder.js";
import { protect } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/founders
// @desc    Public: the founders shown in the site's About section.
router.get("/", asyncHandler(async (req, res) => {
  const founders = await Founder.find().sort({ order: 1, createdAt: 1 });
  res.json({ founders });
}));

// @route   GET /api/founders/me
// @desc    The logged-in user's own founder profile, if they have one.
//          Powers the "Founder profile" editor in their dashboard — that
//          section simply doesn't render for anyone this returns null for.
router.get("/me", protect, asyncHandler(async (req, res) => {
  const founder = await Founder.findOne({ user: req.user._id });
  res.json({ founder });
}));

// @route   PATCH /api/founders/me
// @desc    Update the caller's own founder profile. There is deliberately
//          no create/upsert here and no :id param — you can only ever
//          touch the one document already linked to your own account, so
//          this can't be used to claim or edit anyone else's entry.
router.patch("/me", protect, asyncHandler(async (req, res) => {
  const founder = await Founder.findOne({ user: req.user._id });
  if (!founder) {
    return res.status(403).json({ message: "You don't have a founder profile to edit" });
  }

  const { name, degree, role, expertise, quote, email, links } = req.body;
  if (name !== undefined) founder.name = name;
  if (degree !== undefined) founder.degree = degree;
  if (role !== undefined) founder.role = role;
  if (expertise !== undefined) founder.expertise = Array.isArray(expertise) ? expertise : [];
  if (quote !== undefined) founder.quote = quote;
  if (email !== undefined) founder.email = email;
  if (links !== undefined) founder.links = { ...founder.links.toObject(), ...links };

  await founder.save();
  res.json({ founder });
}));

export default router;
