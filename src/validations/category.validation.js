import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema } from '../utils/zodHelpers.js';

export const createCategorySchema = {
  body: z
    .object({
      name: bilingualText(1, 100),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/),
      icon: z.string().trim().default(''),
      image: z.string().trim().default(''),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateCategorySchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      name: bilingualTextPartial(100),
      slug: z
        .string()
        .trim()
        .toLowerCase()
        .regex(/^[a-z0-9-]+$/)
        .optional(),
      icon: z.string().trim().optional(),
      image: z.string().trim().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const categoryIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
