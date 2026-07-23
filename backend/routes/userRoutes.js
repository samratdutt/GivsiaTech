import express from "express";
import crypto from "crypto";
import User from "../models/User.js";
import Order from "../models/Order.js";
import ContactMessage from "../models/ContactMessage.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/users
// @desc    Admin: list all users
router.get("/", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const users = await User.find().select("-password").sort({ createdAt: -1 });
  res.json({ users });
}));

// @route   POST /api/users
// @desc    Admin: directly create a user of any role (e.g. a second admin
//          without them self-registering).
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { name, email, password, role, company, address, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ message: "Name, email, phone and password are required" });
    }
    if (role && !["admin", "client"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const [existingEmail, existingPhone] = await Promise.all([
      User.findOne({ email: email.toLowerCase() }),
      User.findOne({ phone }),
    ]);
    if (existingEmail) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }
    if (existingPhone) {
      return res.status(409).json({ message: "An account with this phone number already exists" });
    }

    // Admin-created accounts are trusted at creation time — no OTP round trip.
    const user = await User.create({ name, email, password, phone, phoneVerified: true, address, company, role: role || "client" });
    res.status(201).json({ user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ message: "Could not create user", error: err.message });
  }
});

// @route   PATCH /api/users/me
// @desc    Self-service profile edit, available to every role (client and
//          admin alike). Only name/address/company/password are touchable
//          here — email, phone, role, and isActive are identity/
//          permission-sensitive and deliberately excluded, since only an
//          admin should be able to change those (via the routes below).
router.patch("/me", protect, asyncHandler(async (req, res) => {
  const { name, address, company, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (name !== undefined) user.name = name;
  if (address !== undefined) user.address = address;
  if (company !== undefined) user.company = company;

  if (newPassword) {
    if (!user.password) {
      return res.status(400).json({ message: "This account signs in with Google and has no password to change" });
    }
    if (!currentPassword || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    user.password = newPassword;
    user.tokenVersion += 1; // invalidate every other outstanding session on this account
  }

  await user.save();
  res.json({ user: user.toSafeObject() });
}));

// @route   DELETE /api/users/me
// @desc    Self-service account deletion. Anonymizes rather than hard-
//          deletes: Orders/Reviews/ActivityLog reference this user, and a
//          business needs to keep those records (invoices, revenue history,
//          audit trail) even after the account owner is gone — so PII is
//          scrubbed and the account deactivated instead of the document
//          being removed outright. isActive: false alone is enough to lock
//          the account out immediately (protect() rejects inactive users).
router.delete("/me", protect, asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (user.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "Can't delete the last remaining admin account — promote another admin first" });
    }
  }

  if (user.password) {
    if (!currentPassword || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
  }

  const anonymTag = user._id.toString();
  user.name = "Deleted user";
  user.email = `deleted-${anonymTag}@deleted.givsiatech.local`;
  user.phone = `deleted-${anonymTag}`;
  user.address = undefined;
  user.company = undefined;
  user.googleId = undefined;
  user.password = crypto.randomBytes(32).toString("hex"); // unusable, unguessable — login is blocked by isActive anyway
  user.isActive = false;
  user.tokenVersion += 1;
  await user.save();

  res.json({ message: "Your account has been deleted" });
}));

// @route   DELETE /api/users/:id
// @desc    Admin: permanently remove a user account
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    return res.status(400).json({ message: "You can't delete your own account while logged in as it" });
  }

  const target = await User.findById(req.params.id);
  if (!target) return res.status(404).json({ message: "User not found" });

  if (target.role === "admin") {
    const adminCount = await User.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      return res.status(400).json({ message: "Can't delete the last remaining admin" });
    }
  }

  await target.deleteOne();
  res.json({ message: "User deleted" });
}));

// @route   PATCH /api/users/:id/role
// @desc    Admin: change a user's role (e.g. promote client -> admin)
router.patch("/:id/role", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!["admin", "client"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  if (req.params.id === req.user._id.toString() && role !== "admin") {
    return res.status(400).json({ message: "You can't demote your own account while logged in as it" });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
}));

// @route   PATCH /api/users/:id/status
// @desc    Admin: activate/deactivate a user
router.patch("/:id/status", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  if (req.params.id === req.user._id.toString() && !isActive) {
    return res.status(400).json({ message: "You can't deactivate your own account while logged in as it" });
  }

  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select("-password");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json({ user });
}));

// @route   GET /api/users/dashboard-summary
// @desc    Returns role-appropriate dashboard data for the logged-in user.
//          Admin gets a full monitoring overview: users, orders, revenue,
//          pending work, and unread leads, all in one call.
router.get("/dashboard-summary", protect, asyncHandler(async (req, res) => {
  const { role, _id } = req.user;

  if (role === "admin") {
    const [userCount, orderCount, revenueAgg, pendingOrders, newLeads, recentOrders] = await Promise.all([
      User.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Order.countDocuments({ status: { $in: ["pending", "in-progress"] } }),
      ContactMessage.countDocuments({ status: "new" }),
      Order.find().sort({ createdAt: -1 }).limit(5).populate("client", "name email"),
    ]);
    return res.json({
      role,
      stats: {
        totalUsers: userCount,
        totalOrders: orderCount,
        totalRevenue: revenueAgg[0]?.total || 0,
        activeProjects: pendingOrders,
        newLeads,
      },
      recentOrders,
    });
  }

  // client
  const orders = await Order.find({ client: _id }).sort({ createdAt: -1 });
  res.json({ role, myOrders: orders });
}));

export default router;
