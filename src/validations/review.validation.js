import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';
import { REVIEW_STATUSES } from '../models/Review.js';

export const createReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).default(''),
    })
    .strict(),
};

export const listReviewsSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  query: pageQuerySchema,
};

export const adminListReviewsSchema = {
  query: pageQuerySchema.extend({
    productId: objectIdSchema.optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    status: z.enum(REVIEW_STATUSES).optional(), // default: every status
  }),
};

export const moderateReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      status: z.enum(['approved', 'rejected']),
      note: z.string().trim().min(1).max(300).optional(),
    })
    .strict(),
};

export const myReviewSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const reviewIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
