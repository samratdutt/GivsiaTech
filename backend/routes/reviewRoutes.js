import express from "express";
import Review from "../models/Review.js";
import { protect } from "../middleware/auth.js";
import { authorize } from "../middleware/role.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();

// @route   GET /api/reviews
// @desc    Public: every review plus the average rating, for the site's
//          testimonials section.
router.get("/", asyncHandler(async (req, res) => {
  const reviews = await Review.find().populate("client", "name company").sort({ createdAt: -1 });
  const average = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  res.json({ reviews, average: Math.round(average * 10) / 10, count: reviews.length });
}));

// @route   POST /api/reviews
// @desc    Any logged-in client: submit or update their review. One review
//          per client — resubmitting edits the existing one instead of
//          creating a duplicate.
router.post("/", protect, asyncHandler(async (req, res) => {
  const { rating, comment, orderId } = req.body;
  const ratingNum = Number(rating);
  if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ message: "Rating must be between 1 and 5" });
  }
  if (!comment?.trim()) {
    return res.status(400).json({ message: "A comment is required" });
  }

  const review = await Review.findOneAndUpdate(
    { client: req.user._id },
    { rating: ratingNum, comment: comment.trim(), order: orderId || undefined },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ review });
}));

// @route   GET /api/reviews/me
// @desc    The logged-in client's own review, if they've left one.
router.get("/me", protect, asyncHandler(async (req, res) => {
  const review = await Review.findOne({ client: req.user._id });
  res.json({ review });
}));

// @route   DELETE /api/reviews/:id
// @desc    Admin: remove a review (moderation).
router.delete("/:id", protect, authorize("admin"), asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);
  if (!review) return res.status(404).json({ message: "Review not found" });
  await review.deleteOne();
  res.json({ message: "Review deleted" });
}));

export default router;
