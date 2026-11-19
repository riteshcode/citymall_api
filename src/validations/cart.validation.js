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
      variantId: objectIdSchema.optional(), // required when the product has variants (400 VARIANT_REQUIRED)
      qty: z.number().int().min(1).max(999).default(1),
    })
    .strict(),
};

// Lines are identified by product + variant, so PATCH / DELETE take the variant as a query parameter.
const variantQuery = z.object({ variantId: objectIdSchema.optional() }).strict();

export const updateCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
  query: variantQuery,
  body: z
    .object({
      qty: z.number().int().min(0).max(999),
    })
    .strict(),
};

export const removeCartItemSchema = {
  params: z.object({ productId: objectIdSchema }).strict(),
  query: variantQuery,
};

export const applyCouponSchema = {
  body: z
    .object({
      code: z.string().trim().min(3).max(30),
    })
    .strict(),
};
