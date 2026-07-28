import { z } from 'zod';
import { objectIdSchema } from '../utils/zodHelpers.js';

export const addCartItemSchema = {
  body: z
    .object({
      productId: objectIdSchema,
      qty: z.number().int().min(1).max(999).default(1),
    })
    .strict(),
};

export const updateCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
  body: z
    .object({
      qty: z.number().int().min(0).max(999),
    })
    .strict(),
};

export const removeCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
};

export const applyCouponSchema = {
  body: z
    .object({
      code: z.string().trim().min(3).max(30),
    })
    .strict(),
};
