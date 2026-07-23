import express from "express";
import SecurityEvent from "../models/SecurityEvent.js";
import BlockedIP from "../models/BlockedIP.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { logSecurityEvent } from "../utils/security.js";

const router = express.Router();

router.use(protect, authorize("admin"));

// @route   GET /api/security/summary
// @desc    Counts for the Security tab's stat cards — events in the last
//          24h by severity, currently blocked IPs, currently locked accounts.
router.get("/summary", asyncHandler(async (req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [eventsLast24h, eventsLast7d, bySeverity24h, blockedIpCount, byType7d] = await Promise.all([
    SecurityEvent.countDocuments({ createdAt: { $gte: since24h } }),
    SecurityEvent.countDocuments({ createdAt: { $gte: since7d } }),
    SecurityEvent.aggregate([
      { $match: { createdAt: { $gte: since24h } } },
      { $group: { _id: "$severity", count: { $sum: 1 } } },
    ]),
    BlockedIP.countDocuments({ $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }),
    SecurityEvent.aggregate([
      { $match: { createdAt: { $gte: since7d } } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
    ]),
  ]);

  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  bySeverity24h.forEach((s) => { severityCounts[s._id] = s.count; });

  res.json({
    eventsLast24h,
    eventsLast7d,
    severityCounts,
    blockedIpCount,
    byType7d: byType7d.map((t) => ({ type: t._id, count: t.count })).sort((a, b) => b.count - a.count),
  });
}));

// @route   GET /api/security/events
// @desc    Recent security events, most recent first.
router.get("/events", asyncHandler(async (req, res) => {
  const events = await SecurityEvent.find()
    .populate("user", "name email role")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ events });
}));

// @route   GET /api/security/blocked-ips
// @desc    Every currently-tracked IP block (active or already expired —
//          expired ones are pruned by MongoDB's TTL sweep on its own
//          schedule, so a few stale rows briefly lingering is expected).
router.get("/blocked-ips", asyncHandler(async (req, res) => {
  const blocked = await BlockedIP.find().populate("blockedBy", "name email").sort({ createdAt: -1 });
  res.json({ blocked });
}));

// @route   POST /api/security/blocked-ips
// @desc    Manually block an IP. durationHours omitted = permanent.
router.post("/blocked-ips", asyncHandler(async (req, res) => {
  const { ip, reason, durationHours } = req.body;
  if (!ip?.trim()) return res.status(400).json({ message: "An IP address is required" });

  const record = await BlockedIP.findOneAndUpdate(
    { ip: ip.trim() },
    {
      ip: ip.trim(),
      reason: reason?.trim() || `Manually blocked by ${req.user.name}`,
      autoBlocked: false,
      blockedBy: req.user._id,
      expiresAt: durationHours ? new Date(Date.now() + Number(durationHours) * 60 * 60 * 1000) : null,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  await logSecurityEvent({
    type: "ip_blocked",
    severity: "medium",
    ip: record.ip,
    detail: `Manually blocked by ${req.user.name}${reason ? `: ${reason}` : ""}`,
    meta: { autoBlocked: false, permanent: !record.expiresAt },
  });

  res.status(201).json({ blocked: record });
}));

// @route   DELETE /api/security/blocked-ips/:id
// @desc    Unblock an IP.
router.delete("/blocked-ips/:id", asyncHandler(async (req, res) => {
  const record = await BlockedIP.findById(req.params.id);
  if (!record) return res.status(404).json({ message: "Block record not found" });
  await record.deleteOne();

  await logSecurityEvent({
    type: "ip_unblocked",
    severity: "low",
    ip: record.ip,
    detail: `Unblocked by ${req.user.name}`,
  });

  res.json({ message: "IP unblocked" });
}));

export default router;
