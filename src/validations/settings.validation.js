import { z } from 'zod';
import { paiseSchema, pincodeSchema } from '../utils/zodHelpers.js';

const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm, e.g. 08:00');

// Every store-info field may be cleared with "". Format checks apply only to non-empty values.
const blankOr = (schema) => schema.or(z.literal(''));
const phone = blankOr(z.string().trim().regex(/^\+?\d[\d\s-]{5,17}\d$/, 'Enter a valid phone number'));
const gstin = blankOr(
  z.string().trim().toUpperCase().regex(/^[0-3]\d[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid 15-character GSTIN')
);
const fssai = blankOr(z.string().trim().regex(/^\d{14}$/, 'FSSAI licence number is 14 digits'));

export const updateSettingsSchema = {
  body: z
    .object({
      deliveryFee: paiseSchema.optional(),
      freeDeliveryThreshold: paiseSchema.optional(),
      handlingFee: paiseSchema.optional(),
      minOrderValue: paiseSchema.optional(),
      storeOpen: z.boolean().optional(),
      storeTimings: z.object({ open: hhmm.optional(), close: hhmm.optional() }).strict().optional(),
      storeName: z.string().trim().min(1).max(100).optional(),
      phone: phone.optional(),
      whatsapp: phone.optional(),
      email: blankOr(z.string().trim().toLowerCase().email().max(120)).optional(),
      address: z
        .object({
          line1: z.string().trim().max(200).optional(),
          city: z.string().trim().max(80).optional(),
          state: z.string().trim().max(80).optional(),
          pincode: blankOr(pincodeSchema).optional(),
        })
        .strict()
        .optional(),
      fssaiNumber: fssai.optional(),
      gstin: gstin.optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one setting to change' }),
};
