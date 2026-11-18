import { z } from 'zod';
import { objectIdSchema, pincodeSchema } from '../utils/zodHelpers.js';

// Optional: preview that pincode's delivery-fee override so the cart total matches checkout.
export const getCartSchema = {
  query: z.object({ pincode: pincodeSchema.optional() }).strict(),
};

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
