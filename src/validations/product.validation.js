import { z } from 'zod';
import { MAX_VARIANTS } from '../models/Product.js';
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

// ---- variants (same item, different options: Aata 1 kg / 5 kg / 10 kg)
const variantFields = {
  label: bilingualText(1, 60),
  sku: z.string().trim().max(60).default(''),
  mrp: paiseSchema,
  price: paiseSchema,
  stock: z.number().int().min(0),
  images: z.array(z.string().url()).max(10).default([]), // empty = use the product's images
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
};

const withPriceCheck = (schema) => schema.refine((v) => v.price <= v.mrp, { message: 'price cannot exceed mrp', path: ['price'] });

const createVariantSchema = withPriceCheck(z.object(variantFields).strict());
// On PATCH a variant WITH an id updates that variant; one without an id is new. Send the whole variant each time.
const updateVariantSchema = withPriceCheck(z.object({ id: objectIdSchema.optional(), ...variantFields }).strict());

/** Cross-variant rules shared by create and update. */
function checkVariantList(variants, ctx) {
  const issue = (message) => ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['variants'] });
  if (variants.length === 0) return;

  const dupes = (values) => new Set(values).size !== values.length;
  if (dupes(variants.map((v) => v.label.en.toLowerCase())) || dupes(variants.map((v) => v.label.hi.toLowerCase()))) {
    issue('Variant labels must be unique (English and Hindi)');
  }
  const skus = variants.map((v) => v.sku.toLowerCase()).filter(Boolean);
  if (dupes(skus)) issue('Variant sku values must be unique');
  const ids = variants.map((v) => v.id).filter(Boolean);
  if (dupes(ids)) issue('The same variant id appears twice');

  const defaults = variants.filter((v) => v.isDefault);
  if (defaults.length !== 1) issue(`Exactly one variant must have isDefault: true (got ${defaults.length})`);
  else if (!defaults[0].isActive) issue('The default variant must be active');
}

const optionNameField = bilingualText(1, 60);

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
  // Required for a plain product; with variants they are derived from the default variant / the variants' stock
  // and anything sent here is ignored.
  mrp: paiseSchema.optional(),
  price: paiseSchema.optional(),
  unit: z.string().trim().min(1).max(40).optional(),
  stock: z.number().int().min(0).optional(),
  optionName: optionNameField.nullable().optional(),
  variants: z.array(createVariantSchema).max(MAX_VARIANTS).default([]),
  tags: z.array(z.string().trim().toLowerCase()).default([]),
  isActive: z.boolean().default(true),
};

export const createProductSchema = {
  body: z
    .object(productBodyBase)
    .strict()
    .superRefine((v, ctx) => {
      checkVariantList(v.variants, ctx);
      if (v.variants.length > 0) {
        if (!v.optionName) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'optionName is required when the product has variants', path: ['optionName'] });
        return;
      }
      for (const key of ['mrp', 'price', 'unit', 'stock']) {
        if (v[key] === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} is required for a product without variants`, path: [key] });
      }
      if (v.price !== undefined && v.mrp !== undefined && v.price > v.mrp) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'price cannot exceed mrp', path: ['price'] });
      }
    }),
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
      optionName: optionNameField.nullable().optional(),
      // The complete list of variants: ones with an id are updated, ones without are created, ones left out are DELETED.
      // [] turns the product back into a plain one. Omit the key to leave the variants alone.
      variants: z.array(updateVariantSchema).max(MAX_VARIANTS).optional(),
      tags: z.array(z.string().trim().toLowerCase()).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .superRefine((v, ctx) => v.variants && checkVariantList(v.variants, ctx)),
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
