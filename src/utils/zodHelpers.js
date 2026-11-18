import { z } from 'zod';
import mongoose from 'mongoose';

/** Bilingual text field: { en, hi } — both required, non-empty. */
export const bilingualText = (min = 1, max = 300) =>
  z
    .object({
      en: z.string().trim().min(min).max(max),
      hi: z.string().trim().min(min).max(max),
    })
    .strict();

/** Same as bilingualText but both sub-fields optional (for PATCH endpoints). */
export const bilingualTextPartial = (max = 300) =>
  z
    .object({
      en: z.string().trim().max(max).optional(),
      hi: z.string().trim().max(max).optional(),
    })
    .strict()
    .optional();

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number');

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, 'Must be a valid 6-digit Indian pincode');

export const objectIdSchema = z
  .string()
  .refine((v) => mongoose.Types.ObjectId.isValid(v), { message: 'Invalid id' });

export const paiseSchema = z.number().int().nonnegative();

export const pageQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  })
  .strict();

// NOT z.coerce.boolean(): Boolean("false") === true.
export const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');
