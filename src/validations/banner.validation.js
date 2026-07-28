import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema } from '../utils/zodHelpers.js';

export const createBannerSchema = {
  body: z
    .object({
      title: bilingualText(1, 120),
      image: z.string().trim().url(),
      link: z.string().trim().default(''),
      sortOrder: z.number().int().default(0),
      isActive: z.boolean().default(true),
    })
    .strict(),
};

export const updateBannerSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      title: bilingualTextPartial(120),
      image: z.string().trim().url().optional(),
      link: z.string().trim().optional(),
      sortOrder: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

export const bannerIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};
