import express from "express";
import CompanyInfo from "../models/CompanyInfo.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/company
// @desc    Public: the "About" section content (singleton document)
router.get("/", asyncHandler(async (req, res) => {
  const info = await CompanyInfo.findOne();
  res.json({ info });
}));

// @route   PATCH /api/company
// @desc    Admin: update the About section content. Creates the singleton
//          document on first save if it doesn't exist yet.
router.patch("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { heading, description, stats } = req.body;
  const update = {};
  if (heading !== undefined) update.heading = heading;
  if (description !== undefined) update.description = description;
  if (stats !== undefined) update.stats = stats;

  const info = await CompanyInfo.findOneAndUpdate({}, update, { new: true, upsert: true, setDefaultsOnInsert: true });
  res.json({ info });
}));

export default router;
