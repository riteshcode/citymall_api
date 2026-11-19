import { z } from 'zod';
import { bilingualText, objectIdSchema, paiseSchema } from '../utils/zodHelpers.js';

const couponBodyBase = {
  code: z.string().trim().toUpperCase().min(3).max(30),
  description: bilingualText(1, 200).nullable().default(null),
  type: z.enum(['flat', 'percent']),
  value: z.number().int().min(1),
  minOrderValue: paiseSchema.default(0),
  maxDiscount: paiseSchema.nullable().default(null),
  startsAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  usageLimit: z.number().int().min(0).nullable().default(null),
  perUserLimit: z.number().int().min(0).default(1),
  isActive: z.boolean().default(true),
};

export const createCouponSchema = {
  body: z
    .object(couponBodyBase)
    .strict()
    .refine((v) => v.expiresAt > v.startsAt, { message: 'expiresAt must be after startsAt', path: ['expiresAt'] })
    .refine((v) => v.type !== 'percent' || v.value <= 100, {
      message: 'percent coupon value cannot exceed 100',
      path: ['value'],
    }),
};

export const updateCouponSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      description: bilingualText(1, 200).nullable().optional(), // null removes it
      type: z.enum(['flat', 'percent']).optional(),
      value: z.number().int().min(1).optional(),
      minOrderValue: paiseSchema.optional(),
      maxDiscount: paiseSchema.nullable().optional(),
      startsAt: z.coerce.date().optional(),
      expiresAt: z.coerce.date().optional(),
      usageLimit: z.number().int().min(0).nullable().optional(),
      perUserLimit: z.number().int().min(0).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const couponIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

// GET /coupons/available takes no parameters.
export const availableCouponsSchema = {
  query: z.object({}).strict(),
};
