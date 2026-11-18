import { z } from 'zod';
import { bilingualText, bilingualTextPartial, objectIdSchema, paiseSchema } from '../utils/zodHelpers.js';

export const listProductsSchema = {
  query: z
    .object({
      category: objectIdSchema.optional(),
      minPrice: z.coerce.number().int().min(0).optional(),
      maxPrice: z.coerce.number().int().min(0).optional(),
      brand: z.string().trim().min(1).max(80).optional(),
      rating: z.coerce.number().min(0).max(5).optional(),
      // NOT z.coerce.boolean(): Boolean("false") === true, so ?inStock=false would turn the filter ON.
      inStock: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
      sort: z.enum(['popular', 'price_asc', 'price_desc', 'newest', 'discount']).default('newest'),
      q: z.string().trim().min(1).max(120).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict(),
};

export const suggestProductsSchema = {
  query: z.object({ q: z.string().trim().min(1).max(60) }).strict(),
};

export const productSlugParamSchema = {
  params: z.object({ slug: z.string().trim().min(1) }).strict(),
};

export const productIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const relatedProductsSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  query: z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) }).strict(),
};

const productBodyBase = {
  title: bilingualText(1, 200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/),
  description: bilingualText(1, 4000),
  category: objectIdSchema,
  brand: z.string().trim().max(80).default(''),
  images: z.array(z.string().url()).default([]),
  mrp: paiseSchema,
  price: paiseSchema,
  unit: z.string().trim().min(1).max(40),
  stock: z.number().int().min(0),
  tags: z.array(z.string().trim().toLowerCase()).default([]),
  isActive: z.boolean().default(true),
};

export const createProductSchema = {
  body: z
    .object(productBodyBase)
    .strict()
    .refine((v) => v.price <= v.mrp, { message: 'price cannot exceed mrp', path: ['price'] }),
};

export const updateProductSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      title: bilingualTextPartial(200),
      description: bilingualTextPartial(4000),
      category: objectIdSchema.optional(),
      brand: z.string().trim().max(80).optional(),
      images: z.array(z.string().url()).optional(),
      mrp: paiseSchema.optional(),
      price: paiseSchema.optional(),
      unit: z.string().trim().min(1).max(40).optional(),
      stock: z.number().int().min(0).optional(),
      tags: z.array(z.string().trim().toLowerCase()).optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
};

// ---- bulk / CSV (admin)
// The body is only checked to be an array here; each ROW is validated individually by the service, so one bad
// row is reported in `failed` instead of rejecting the whole request.
export const bulkUpdateProductsSchema = {
  body: z.array(z.unknown()).min(1, 'Send at least one row').max(200, 'At most 200 rows per request'),
};

export const importProductsSchema = {
  query: z.object({ dryRun: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }).strict(),
};
