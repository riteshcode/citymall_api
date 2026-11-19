import { Review } from '../models/Review.js';

/**
 * Idempotent data migrations, run on every server start (and by `npm run migrate`). Each one only touches documents
 * that still need it, so re-running is free. Things that are handled by schema defaults instead (no migration needed):
 *   - products without `variants` / `optionName`  -> plain products
 *   - cart lines / order items without a variant  -> variantId: null, variantLabel: null
 */
export async function runMigrations() {
  const report = {};

  // Reviews written before moderation existed were already public: keep them visible and counted.
  // (Their product ratings are unchanged because every one of them stays "approved".)
  const reviews = await Review.updateMany(
    { status: { $exists: false } },
    { $set: { status: 'approved', moderatedAt: null, moderationNote: null } }
  );
  report.reviewsApproved = reviews.modifiedCount;

  return report;
}
