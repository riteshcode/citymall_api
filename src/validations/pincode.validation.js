import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema, paiseSchema, pageQuerySchema, pincodeSchema } from '../utils/zodHelpers.js';

const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listPincodesSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(60).optional(), // pincode prefix/substring or area name
    isActive: boolParam.optional(),
  }),
};

export const createPincodeSchema = {
  body: z
    .object({
      pincode: pincodeSchema,
      areaName: bilingualText(1, 100),
      isActive: z.boolean().default(true),
      deliveryFee: paiseSchema.nullable().default(null), // null = use the store-wide delivery fee
      etaDays: z.number().int().min(0).max(30).default(2),
    })
    .strict(),
};

export const updatePincodeSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      pincode: pincodeSchema.optional(),
      areaName: bilingualTextPartial(100),
      isActive: z.boolean().optional(),
      deliveryFee: paiseSchema.nullable().optional(),
      etaDays: z.number().int().min(0).max(30).optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one field to change' }),
};

export const pincodeIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
