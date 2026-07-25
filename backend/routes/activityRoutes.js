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

// @route   DELETE /api/activity/:id
// @desc    Admin — remove a single activity entry. This is just a rolling
//          feed (auto-expires after 30 days anyway, see ActivityLog.js), so
//          deleting one has no effect on any real business record.
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const entry = await ActivityLog.findByIdAndDelete(req.params.id);
  if (!entry) return res.status(404).json({ message: "Activity entry not found" });
  res.json({ message: "Activity entry deleted" });
}));

// @route   DELETE /api/activity
// @desc    Admin — clear the entire activity feed in one go.
router.delete("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { deletedCount } = await ActivityLog.deleteMany({});
  res.json({ message: "Activity cleared", deletedCount });
}));

export default router;
