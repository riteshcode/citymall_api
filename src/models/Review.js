import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'];

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: '', maxlength: 1000 },
    // New reviews wait for an admin; only "approved" ones are shown on the storefront and count towards the rating.
    // Reviews that existed before moderation were marked "approved" by the migration (src/migrations).
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending', index: true },
    moderatedAt: { type: Date, default: null },
    moderationNote: { type: String, trim: true, maxlength: 300, default: null },
  },
  { timestamps: true }
);

reviewSchema.index({ user: 1, product: 1 }, { unique: true });
reviewSchema.index({ product: 1, status: 1, createdAt: -1 });

toJSONPlugin(reviewSchema);

export const Review = mongoose.model('Review', reviewSchema);
