import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';

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
