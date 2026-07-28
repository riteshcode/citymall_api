import { z } from 'zod';
import { pincodeSchema, objectIdSchema } from '../utils/zodHelpers.js';

const addressBody = z
  .object({
    label: z.string().trim().max(30).default('Home'),
    line1: z.string().trim().min(1).max(200),
    line2: z.string().trim().max(200).default(''),
    landmark: z.string().trim().max(120).default(''),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(1).max(80),
    pincode: pincodeSchema,
    isDefault: z.boolean().default(false),
  })
  .strict();

export const createAddressSchema = { body: addressBody };

export const updateAddressSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: addressBody.partial(),
};

export const addressIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const serviceabilitySchema = {
  query: z.object({ pincode: pincodeSchema }).strict(),
};
