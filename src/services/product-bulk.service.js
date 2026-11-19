import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { Product, MAX_VARIANTS } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { toCsv } from '../utils/csv.js';
import { hasVariants } from '../utils/variants.js';

export const BULK_MAX_ROWS = 200;
export const IMPORT_MAX_ROWS = 2000;

/**
 * One row per product, or - for products with variants - one row per VARIANT (product columns repeated).
 * On a variant row mrp / price / stock / isActive belong to the variant; `unit` is the variant's English label and is
 * ignored on import (it is derived). Switching a whole product on/off is not part of the CSV: use PATCH /admin/products/:id.
 */
export const CSV_COLUMNS = [
  'id',
  'variant_id',
  'variant_label_en',
  'variant_label_hi',
  'sku',
  'slug',
  'title_en',
  'title_hi',
  'option_name_en',
  'option_name_hi',
  'category_slug',
  'brand',
  'unit',
  'mrp',
  'price',
  'stock',
  'isActive',
];

const firstIssue = (err) => {
  const issue = err.issues[0];
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
};

const isObjectId = (v) => mongoose.Types.ObjectId.isValid(v);

// ================================================================== bulk PATCH

const bulkRowSchema = z
  .object({
    id: z.string().refine(isObjectId, 'Invalid id'),
    variantId: z.string().refine(isObjectId, 'Invalid variantId').optional(), // change that variant instead of the product
    price: z.number().int().min(0).optional(),
    mrp: z.number().int().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((row) => Object.keys(row).some((k) => k !== 'id' && k !== 'variantId'), {
    message: 'Nothing to update: send price, mrp, stock or isActive',
  });

/**
 * Updates many products (or single variants) at once. Each row is validated on its own, so one bad row never blocks the
 * others; the response lists what failed. price <= mrp is checked against the FINAL values (a row changing only `price`
 * is compared with the current `mrp`, and vice-versa).
 *  - A row with `variantId` changes that variant's price / mrp / stock / isActive (the product's own price, mrp, stock
 *    and unit are re-derived from its variants). A variant row may not deactivate the default variant.
 *  - A row WITHOUT `variantId` on a product that has variants may only send `isActive` (the product on/off): its price,
 *    mrp and stock live on the variants.
 * @param {unknown[]} rows already known to be an array of at most BULK_MAX_ROWS items
 */
export async function bulkUpdateProducts(rows) {
  const failed = [];
  const valid = [];
  const seen = new Set();

  rows.forEach((raw) => {
    const parsed = bulkRowSchema.safeParse(raw);
    const rawId = raw && typeof raw === 'object' && 'id' in raw ? String(raw.id) : null;
    if (!parsed.success) return failed.push({ id: rawId, error: firstIssue(parsed.error) });
    const key = `${parsed.data.id}:${parsed.data.variantId ?? ''}`;
    if (seen.has(key)) {
      return failed.push({ id: parsed.data.id, ...(parsed.data.variantId ? { variantId: parsed.data.variantId } : {}), error: 'Duplicate id in this request' });
    }
    seen.add(key);
    valid.push(parsed.data);
  });

  const products = await Product.find({ _id: { $in: valid.map((r) => r.id) } });
  const byId = new Map(products.map((p) => [p.id, p]));

  const operations = []; // plain products / product-level isActive
  const variantRowsByProduct = new Map(); // productId -> rows applied to the in-memory doc, saved once at the end
  let updated = 0;

  for (const { id, variantId, ...changes } of valid) {
    const fail = (error) => failed.push({ id, ...(variantId ? { variantId } : {}), error });
    const product = byId.get(id);
    if (!product) {
      fail('Product not found');
      continue;
    }

    if (variantId) {
      const variant = product.variants.id(variantId);
      if (!hasVariants(product) || !variant) {
        fail(hasVariants(product) ? 'Variant not found' : 'This product has no variants');
        continue;
      }
      const mrp = changes.mrp ?? variant.mrp;
      const price = changes.price ?? variant.price;
      if (price > mrp) {
        fail(`price (${price}) cannot exceed mrp (${mrp})`);
        continue;
      }
      if (changes.isActive === false && variant.isDefault) {
        fail('The default variant must stay active: make another variant the default first');
        continue;
      }
      variant.set(changes);
      if (!variantRowsByProduct.has(id)) variantRowsByProduct.set(id, []);
      variantRowsByProduct.get(id).push({ id, variantId });
      continue;
    }

    if (hasVariants(product)) {
      if (changes.price !== undefined || changes.mrp !== undefined || changes.stock !== undefined) {
        fail('This product has variants: send variantId to change price, mrp or stock');
        continue;
      }
    } else {
      const mrp = changes.mrp ?? product.mrp;
      const price = changes.price ?? product.price;
      if (price > mrp) {
        fail(`price (${price}) cannot exceed mrp (${mrp})`);
        continue;
      }
    }
    operations.push({ updateOne: { filter: { _id: id }, update: { $set: changes } } });
  }

  if (operations.length) await Product.bulkWrite(operations, { ordered: false });
  updated += operations.length;

  for (const [id, applied] of variantRowsByProduct) {
    try {
      await byId.get(id).save(); // the model hook re-derives price / mrp / unit / stock
      updated += applied.length;
    } catch (err) {
      applied.forEach((r) => failed.push({ ...r, error: `Could not save: ${err.message}` }));
    }
  }

  return { updated, failed };
}

// ================================================================== CSV export

/** All products (inactive included) as CSV; a product with variants gets one row per variant. Money columns are integer PAISE. */
export async function exportProductsCsv() {
  const products = await Product.find().sort({ createdAt: 1 }).populate('category', 'slug').lean();
  const rows = [];

  for (const p of products) {
    const base = {
      id: p._id.toString(),
      variant_id: '',
      variant_label_en: '',
      variant_label_hi: '',
      sku: '',
      slug: p.slug,
      title_en: p.title.en,
      title_hi: p.title.hi,
      option_name_en: p.optionName?.en ?? '',
      option_name_hi: p.optionName?.hi ?? '',
      category_slug: p.category?.slug ?? '',
      brand: p.brand,
    };
    if (!p.variants?.length) {
      rows.push({ ...base, unit: p.unit, mrp: p.mrp, price: p.price, stock: p.stock, isActive: p.isActive });
      continue;
    }
    for (const v of p.variants) {
      rows.push({
        ...base,
        variant_id: v._id.toString(),
        variant_label_en: v.label.en,
        variant_label_hi: v.label.hi,
        sku: v.sku ?? '',
        unit: v.label.en,
        mrp: v.mrp,
        price: v.price,
        stock: v.stock,
        isActive: v.isActive,
      });
    }
  }
  return toCsv(CSV_COLUMNS, rows);
}

// ================================================================== CSV import

const blank = (v) => v === undefined || v === '';
const toInt = (v, name) => {
  if (!/^\d+$/.test(v)) throw new Error(`${name} must be a whole number of paise/units (no decimals, signs or symbols), got "${v}"`);
  return Number(v);
};
const toBool = (v) => {
  const t = v.toLowerCase();
  if (['true', '1', 'yes'].includes(t)) return true;
  if (['false', '0', 'no'].includes(t)) return false;
  throw new Error(`isActive must be true or false, got "${v}"`);
};

/** Turns one CSV row into typed fields (only the cells that were filled in), or throws a readable Error. */
function normaliseRow(raw, categoryBySlug) {
  const out = {};

  if (!blank(raw.id)) {
    if (!isObjectId(raw.id)) throw new Error(`id "${raw.id}" is not a valid id`);
    out.id = raw.id;
  }
  if (!blank(raw.variant_id)) {
    if (!isObjectId(raw.variant_id)) throw new Error(`variant_id "${raw.variant_id}" is not a valid id`);
    out.variantId = raw.variant_id;
  }
  if (blank(raw.slug)) throw new Error('slug is required');
  out.slug = raw.slug.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(out.slug)) throw new Error('slug may only contain a-z, 0-9 and "-"');

  const texts = [
    ['title_en', 'titleEn', 200],
    ['title_hi', 'titleHi', 200],
    ['brand', 'brand', 80],
    ['unit', 'unit', 40],
    ['variant_label_en', 'labelEn', 60],
    ['variant_label_hi', 'labelHi', 60],
    ['sku', 'sku', 60],
    ['option_name_en', 'optionEn', 60],
    ['option_name_hi', 'optionHi', 60],
  ];
  for (const [col, key, max] of texts) {
    if (blank(raw[col])) continue;
    if (raw[col].length > max) throw new Error(`${col} is longer than ${max} characters`);
    out[key] = raw[col];
  }

  if (!blank(raw.category_slug)) {
    const category = categoryBySlug.get(raw.category_slug.toLowerCase());
    if (!category) throw new Error(`category_slug "${raw.category_slug}" does not exist`);
    out.category = category._id;
  }

  for (const col of ['mrp', 'price', 'stock']) if (!blank(raw[col])) out[col] = toInt(raw[col], col);
  if (!blank(raw.isActive)) out.isActive = toBool(raw.isActive);

  out.isVariantRow = Boolean(out.variantId || out.labelEn || out.labelHi);
  if (!out.isVariantRow && out.sku !== undefined) throw new Error('sku belongs to a variant: fill variant_label_en / variant_label_hi (or variant_id) too');
  return out;
}

function parseCsv(buffer) {
  let records;
  try {
    records = parse(buffer.toString('utf8'), {
      bom: true,
      columns: (header) => header.map((h) => h.trim()),
      skip_empty_lines: true,
      trim: true,
    });
  } catch (err) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, `The CSV could not be read: ${err.message}`);
  }

  if (records.length === 0) throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'The CSV has no data rows');
  if (records.length > IMPORT_MAX_ROWS) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, `The CSV has ${records.length} rows; the limit is ${IMPORT_MAX_ROWS} per import`);
  }

  const header = Object.keys(records[0]);
  const unknown = header.filter((h) => !CSV_COLUMNS.includes(h));
  if (unknown.length) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, `Unknown column(s): ${unknown.join(', ')}. Expected: ${CSV_COLUMNS.join(', ')}`);
  }
  if (!header.includes('slug')) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'The CSV needs a "slug" column');
  }
  return records;
}

const lower = (s) => String(s ?? '').trim().toLowerCase();

/** Copy of a working state (ObjectIds inside are immutable and shared on purpose: structuredClone would turn them into plain objects). */
const cloneState = (s) => ({
  ...s,
  fields: { ...s.fields },
  optionName: s.optionName ? { ...s.optionName } : null,
  variants: s.variants.map((v) => ({ ...v, label: { ...v.label }, images: [...(v.images ?? [])] })),
  rows: [...s.rows],
});

/** Applies one variant row to a working list of plain variant objects (mutates `variants`), or throws a readable Error. */
function applyVariantRow(f, variants, hasOptionName) {
  let variant;
  if (f.variantId) {
    variant = variants.find((v) => String(v._id) === f.variantId);
    if (!variant) throw new Error(`No variant has id ${f.variantId} on this product`);
  } else if (f.labelEn) {
    variant = variants.find((v) => lower(v.label.en) === lower(f.labelEn));
  }

  if (!variant) {
    // a new variant
    const missing = [['labelEn', 'variant_label_en'], ['labelHi', 'variant_label_hi'], ['mrp', 'mrp'], ['price', 'price'], ['stock', 'stock']]
      .filter(([k]) => f[k] === undefined)
      .map(([, col]) => col);
    if (missing.length) throw new Error(`New variant is missing: ${missing.join(', ')}`);
    if (!hasOptionName && !(f.optionEn && f.optionHi)) throw new Error('option_name_en and option_name_hi are required to add variants (e.g. "Pack size")');
    if (variants.length >= MAX_VARIANTS) throw new Error(`A product can have at most ${MAX_VARIANTS} variants`);
    variant = { label: { en: f.labelEn, hi: f.labelHi }, sku: '', images: [], isDefault: variants.length === 0, isActive: true };
    variants.push(variant);
  } else {
    if (f.labelEn) variant.label = { ...variant.label, en: f.labelEn };
    if (f.labelHi) variant.label = { ...variant.label, hi: f.labelHi };
  }

  if (f.sku !== undefined) variant.sku = f.sku;
  if (f.mrp !== undefined) variant.mrp = f.mrp;
  if (f.price !== undefined) variant.price = f.price;
  if (f.stock !== undefined) variant.stock = f.stock;
  if (f.isActive !== undefined) {
    if (f.isActive === false && variant.isDefault) throw new Error('The default variant must stay active');
    variant.isActive = f.isActive;
  }

  if (variant.price > variant.mrp) throw new Error(`price (${variant.price}) cannot exceed mrp (${variant.mrp})`);
  const others = variants.filter((v) => v !== variant);
  if (others.some((v) => lower(v.label.en) === lower(variant.label.en) || lower(v.label.hi) === lower(variant.label.hi))) {
    throw new Error(`Another variant already has the label "${variant.label.en}" / "${variant.label.hi}"`);
  }
  if (variant.sku && others.some((v) => v.sku && lower(v.sku) === lower(variant.sku))) throw new Error(`sku "${variant.sku}" is used by another variant`);
}

/**
 * Creates / updates products (and their variants) from a CSV in the export format.
 *  - A row with an `id` updates that product; otherwise the `slug` decides: existing slug = update, new slug = create.
 *  - On updates a blank cell means "leave unchanged". Creates need title_en, title_hi, category_slug and either
 *    unit + mrp + price + stock (a plain product) or variant rows (the description is initialised from the title).
 *  - Variant rows (any of variant_id / variant_label_en / variant_label_hi filled) change ONE variant: found by variant_id,
 *    else by its English label, else created (needs both labels, mrp, price, stock and option_name_en/hi on the product).
 *    A product may have many variant rows but only one plain row; the first variant of a new product becomes the default.
 *    Variants missing from the file are left alone (the CSV never deletes).
 *  - Valid rows are applied even when others fail; failures come back as [{ row, error }] with the spreadsheet row
 *    number (the header is row 1). dryRun=true validates everything and reports the counts without writing.
 */
export async function importProductsCsv(buffer, { dryRun = false } = {}) {
  const records = parseCsv(buffer);

  const categories = await Category.find().select('slug');
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const rows = records.map((raw, i) => ({ raw, row: i + 2 }));
  const ids = rows.map((r) => r.raw.id).filter((v) => v && isObjectId(v));
  const slugs = rows.map((r) => r.raw.slug?.toLowerCase()).filter(Boolean);
  const existing = await Product.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }] });
  const byId = new Map(existing.map((p) => [p.id, p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  const errors = [];
  const states = new Map(); // product key -> working state, saved once all rows were checked
  const claimedSlugs = new Map(); // slug -> state key, for slugs introduced by this file

  for (const { raw, row } of rows) {
    try {
      const f = normaliseRow(raw, categoryBySlug);
      const target = f.id ? byId.get(f.id) : bySlug.get(f.slug);
      if (f.id && !target) throw new Error(`No product has id ${f.id}`);

      const slugOwner = bySlug.get(f.slug);
      if (target && slugOwner && slugOwner.id !== target.id) throw new Error(`slug "${f.slug}" already belongs to another product`);

      const key = target ? `id:${target.id}` : `slug:${f.slug}`;
      let state = states.get(key);
      if (!state) {
        state = {
          key,
          target: target ?? null,
          fields: {}, // product-level changes, accumulated over its rows
          optionName: target?.optionName ? { en: target.optionName.en, hi: target.optionName.hi } : null,
          variants: target ? target.variants.map((v) => v.toObject()) : [],
          variantsTouched: false,
          plainRows: 0,
          rows: [],
        };
      }
      const claimedBy = claimedSlugs.get(f.slug);
      if (!target && claimedBy && claimedBy !== key) throw new Error(`Duplicate: slug "${f.slug}" already appears in an earlier row`);

      // Work on a copy so a row that fails halfway leaves the state untouched.
      const next = cloneState(state);
      const fields = next.fields;

      if (f.isVariantRow) {
        if (state.plainRows > 0 && state.fields.price !== undefined) {
          throw new Error('An earlier row defines this product as a plain product (with its own price); a product cannot be both');
        }
        if (f.optionEn || f.optionHi) next.optionName = { en: f.optionEn ?? next.optionName?.en, hi: f.optionHi ?? next.optionName?.hi };
        applyVariantRow(f, next.variants, Boolean(next.optionName?.en && next.optionName?.hi));
        next.variantsTouched = true;
      } else {
        if (state.plainRows > 0) {
          throw new Error(target ? 'Duplicate: this product already appears in an earlier row' : `Duplicate: slug "${f.slug}" already appears in an earlier row`);
        }
        const gainsVariants = next.variants.length > 0;
        if (gainsVariants && (f.mrp !== undefined || f.price !== undefined || f.stock !== undefined || f.unit !== undefined)) {
          throw new Error('This product has variants: price, mrp and stock go on the variant rows (fill variant_label_en / variant_id)');
        }
        if (!gainsVariants) {
          const mrp = f.mrp ?? fields.mrp ?? target?.mrp;
          const price = f.price ?? fields.price ?? target?.price;
          if (mrp !== undefined && price !== undefined && price > mrp) throw new Error(`price (${price}) cannot exceed mrp (${mrp})`);
          for (const k of ['unit', 'mrp', 'price', 'stock']) if (f[k] !== undefined) fields[k] = f[k];
          if (f.isActive !== undefined) fields.isActive = f.isActive;
        }
        next.plainRows += 1;
        if (f.optionEn || f.optionHi) next.optionName = { en: f.optionEn ?? next.optionName?.en, hi: f.optionHi ?? next.optionName?.hi };
      }

      for (const k of ['titleEn', 'titleHi', 'brand', 'category']) if (f[k] !== undefined) fields[k] = f[k];
      fields.slug = f.slug;
      next.rows.push(row);

      states.set(key, next);
      if (!target) claimedSlugs.set(f.slug, key);
    } catch (err) {
      errors.push({ row, error: err.code === 11000 ? 'slug already exists' : err.message });
    }
  }

  let created = 0;
  let updated = 0;

  for (const state of states.values()) {
    const failAll = (message) => state.rows.forEach((row) => errors.push({ row, error: message }));
    const { fields } = state;
    const variantMode = state.variants.length > 0;

    try {
      if (state.target) {
        if (!dryRun) {
          const t = state.target;
          t.set({
            slug: fields.slug,
            ...(fields.titleEn || fields.titleHi ? { title: { en: fields.titleEn ?? t.title.en, hi: fields.titleHi ?? t.title.hi } } : {}),
            ...(fields.category ? { category: fields.category } : {}),
            ...(fields.brand !== undefined ? { brand: fields.brand } : {}),
            ...(fields.unit !== undefined ? { unit: fields.unit } : {}),
            ...(fields.mrp !== undefined ? { mrp: fields.mrp } : {}),
            ...(fields.price !== undefined ? { price: fields.price } : {}),
            ...(fields.stock !== undefined ? { stock: fields.stock } : {}),
            ...(fields.isActive !== undefined ? { isActive: fields.isActive } : {}),
          });
          if (state.variantsTouched) {
            t.optionName = state.optionName;
            t.variants = state.variants;
          }
          await t.save();
        }
        updated += 1;
        continue;
      }

      // new product
      const need = variantMode ? ['titleEn', 'titleHi', 'category'] : ['titleEn', 'titleHi', 'category', 'unit', 'mrp', 'price', 'stock'];
      const missing = need.filter((k) => fields[k] === undefined);
      if (missing.length) {
        const names = { titleEn: 'title_en', titleHi: 'title_hi', category: 'category_slug' };
        throw new Error(`New product is missing: ${missing.map((k) => names[k] ?? k).join(', ')}`);
      }
      if (!variantMode && fields.price > fields.mrp) throw new Error(`price (${fields.price}) cannot exceed mrp (${fields.mrp})`);

      if (!dryRun) {
        await Product.create({
          slug: fields.slug,
          title: { en: fields.titleEn, hi: fields.titleHi },
          description: { en: fields.titleEn, hi: fields.titleHi }, // placeholder: the CSV has no description column
          category: fields.category,
          brand: fields.brand ?? '',
          isActive: fields.isActive ?? true,
          ...(variantMode
            ? { optionName: state.optionName, variants: state.variants } // price / mrp / unit / stock are derived
            : { unit: fields.unit, mrp: fields.mrp, price: fields.price, stock: fields.stock }),
        });
      }
      created += 1;
    } catch (err) {
      failAll(err.code === 11000 ? 'slug already exists' : err.message);
    }
  }

  errors.sort((a, b) => a.row - b.row);
  return { created, updated, errors, dryRun };
}
