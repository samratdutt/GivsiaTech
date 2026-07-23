import express from "express";
import fs from "fs";
import { uploadImage, verifyImageSignature } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { uploadLimiter } from "../middleware/rateLimit.js";
import { logSecurityEvent } from "../utils/security.js";

const router = express.Router();

// @route   POST /api/uploads/image
// @desc    Admin: upload a project image (used for both an order's
//          in-progress/publish picture and a portfolio card background).
//          Returns a relative URL under /uploads — the frontend prefixes
//          it with the API origin when rendering.
router.post("/image", protect, authorize("admin"), uploadLimiter, uploadImage.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image file received" });
  }

  // multer's fileFilter already checked the claimed MIME type; this checks
  // what was actually written to disk matches a real image format, so a
  // relabeled non-image file can't slip through even from a trusted admin
  // session (compromised credentials, or a mistaken upload).
  if (!verifyImageSignature(req.file.path)) {
    fs.unlink(req.file.path, () => {});
    logSecurityEvent({
      type: "upload_rejected",
      severity: "high",
      ip: req.ip,
      path: req.originalUrl.split("?")[0],
      user: req.user._id,
      detail: `Rejected an upload whose content didn't match its claimed image type (${req.file.originalname})`,
    });
    return res.status(400).json({ message: "This file's content doesn't match a valid image format" });
  }

  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

// Multer errors (bad file type, too large) reject before reaching the
// handler above — this catches those instead of falling through to the
// generic 500 handler, so the admin sees why the upload failed.
router.use((err, req, res, next) => {
  if (err) return res.status(400).json({ message: err.message });
  next();
});

export default router;
