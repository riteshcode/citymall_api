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

/** Staff username: 3-30 chars of a-z 0-9 . _  (trimmed and lower-cased first). */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._]{3,30}$/, 'Username must be 3-30 characters: a-z, 0-9, "." and "_"');

/** Staff password: at least 8 characters with a letter and a number (bcrypt only reads the first 72 bytes). */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password is too long (max 72 bytes)')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain a letter and a number');

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
