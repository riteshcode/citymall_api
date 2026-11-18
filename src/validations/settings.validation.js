import { z } from 'zod';
import { paiseSchema } from '../utils/zodHelpers.js';

const hhmm = z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:mm, e.g. 08:00');

export const updateSettingsSchema = {
  body: z
    .object({
      deliveryFee: paiseSchema.optional(),
      freeDeliveryThreshold: paiseSchema.optional(),
      handlingFee: paiseSchema.optional(),
      minOrderValue: paiseSchema.optional(),
      storeOpen: z.boolean().optional(),
      storeTimings: z.object({ open: hhmm.optional(), close: hhmm.optional() }).strict().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, { message: 'Send at least one setting to change' }),
};
