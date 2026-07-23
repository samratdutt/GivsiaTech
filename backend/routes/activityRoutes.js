import express from "express";
import ActivityLog from "../models/ActivityLog.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/activity
// @desc    Admin — recent user/client activity (registrations, logins,
//          orders, deletes, outreach sends, etc.), most recent first.
router.get("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const activity = await ActivityLog.find().sort({ createdAt: -1 }).limit(300);
  res.json({ activity });
}));

export default router;
