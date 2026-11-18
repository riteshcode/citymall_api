import { z } from 'zod';
import { boolParam, mobileSchema, objectIdSchema, pageQuerySchema, paiseSchema } from '../utils/zodHelpers.js';

const ORDER_STATUSES = ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

// ---- admin: manage riders
export const adminListRidersSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(40).optional(), // name or mobile
    isActive: boolParam.optional(),
  }),
};

export const createRiderSchema = {
  body: z
    .object({
      name: z.string().trim().min(1).max(80),
      mobile: mobileSchema,
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateRiderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      mobile: mobileSchema.optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to change' }),
};

// ---- rider app
export const riderOrdersSchema = {
  query: pageQuerySchema.extend({ status: z.enum(ORDER_STATUSES).optional() }),
};

export const riderOrderIdSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const deliverOrderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      // A STRING on purpose: as a number "0042" would lose its leading zeros.
      otp: z.string().trim().regex(/^\d{4}$/, 'The delivery OTP is 4 digits'),
      cashCollected: paiseSchema.optional(), // paise; required for unpaid COD orders
    })
    .strict(),
};
