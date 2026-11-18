import mongoose from 'mongoose';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { toCsv } from '../utils/csv.js';

export const BULK_MAX_ROWS = 200;
export const IMPORT_MAX_ROWS = 2000;

export const CSV_COLUMNS = ['id', 'slug', 'title_en', 'title_hi', 'category_slug', 'brand', 'unit', 'mrp', 'price', 'stock', 'isActive'];

// ================================================================== bulk PATCH

const bulkRowSchema = z
  .object({
    id: z.string().refine((v) => mongoose.Types.ObjectId.isValid(v), 'Invalid id'),
    price: z.number().int().min(0).optional(),
    mrp: z.number().int().min(0).optional(),
    stock: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((row) => Object.keys(row).length > 1, { message: 'Nothing to update: send price, mrp, stock or isActive' });

const firstIssue = (err) => {
  const issue = err.issues[0];
  return issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
};

/**
 * Updates many products at once. Each row is validated on its own, so one bad row never blocks the others;
 * the response lists what failed. price <= mrp is checked against the FINAL values (a row changing only
 * `price` is compared with the product's current `mrp`, and vice-versa).
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
    if (seen.has(parsed.data.id)) return failed.push({ id: parsed.data.id, error: 'Duplicate id in this request' });
    seen.add(parsed.data.id);
    valid.push(parsed.data);
  });

  const products = await Product.find({ _id: { $in: valid.map((r) => r.id) } }).select('mrp price');
  const byId = new Map(products.map((p) => [p.id, p]));

  const operations = [];
  for (const { id, ...changes } of valid) {
    const product = byId.get(id);
    if (!product) {
      failed.push({ id, error: 'Product not found' });
      continue;
    }
    const mrp = changes.mrp ?? product.mrp;
    const price = changes.price ?? product.price;
    if (price > mrp) {
      failed.push({ id, error: `price (${price}) cannot exceed mrp (${mrp})` });
      continue;
    }
    operations.push({ updateOne: { filter: { _id: id }, update: { $set: changes } } });
  }

  if (operations.length) await Product.bulkWrite(operations, { ordered: false });
  return { updated: operations.length, failed };
}

// ================================================================== CSV export

/** All products (inactive included) as CSV. Money columns are integer PAISE, same as the API. */
export async function exportProductsCsv() {
  const products = await Product.find().sort({ createdAt: 1 }).populate('category', 'slug').lean();
  return toCsv(
    CSV_COLUMNS,
    products.map((p) => ({
      id: p._id.toString(),
      slug: p.slug,
      title_en: p.title.en,
      title_hi: p.title.hi,
      category_slug: p.category?.slug ?? '',
      brand: p.brand,
      unit: p.unit,
      mrp: p.mrp,
      price: p.price,
      stock: p.stock,
      isActive: p.isActive,
    }))
  );
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
    if (!mongoose.Types.ObjectId.isValid(raw.id)) throw new Error(`id "${raw.id}" is not a valid id`);
    out.id = raw.id;
  }
  if (blank(raw.slug)) throw new Error('slug is required');
  out.slug = raw.slug.toLowerCase();
  if (!/^[a-z0-9-]+$/.test(out.slug)) throw new Error('slug may only contain a-z, 0-9 and "-"');

  for (const [col, key, max] of [['title_en', 'titleEn', 200], ['title_hi', 'titleHi', 200], ['brand', 'brand', 80], ['unit', 'unit', 40]]) {
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

/**
 * Creates / updates products from a CSV in the export format.
 *  - A row with an `id` updates that product; otherwise the `slug` decides: existing slug = update, new slug = create.
 *  - On updates a blank cell means "leave unchanged". Creates need title_en, title_hi, category_slug, unit, mrp, price, stock
 *    (the description is initialised from the title - edit it afterwards).
 *  - Valid rows are applied even when others fail; failures come back as [{ row, error }] with the spreadsheet row
 *    number (the header is row 1). dryRun=true validates everything and reports the counts without writing.
 */
export async function importProductsCsv(buffer, { dryRun = false } = {}) {
  const records = parseCsv(buffer);

  const categories = await Category.find().select('slug');
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  const rows = records.map((raw, i) => ({ raw, row: i + 2 }));
  const ids = rows.map((r) => r.raw.id).filter((v) => v && mongoose.Types.ObjectId.isValid(v));
  const slugs = rows.map((r) => r.raw.slug?.toLowerCase()).filter(Boolean);
  const existing = await Product.find({ $or: [{ _id: { $in: ids } }, { slug: { $in: slugs } }] });
  const byId = new Map(existing.map((p) => [p.id, p]));
  const bySlug = new Map(existing.map((p) => [p.slug, p]));

  const errors = [];
  let created = 0;
  let updated = 0;
  const claimedProducts = new Set(); // existing products already targeted by an earlier row
  const claimedSlugs = new Set(); // slugs already taken by an earlier row of this file

  for (const { raw, row } of rows) {
    try {
      const f = normaliseRow(raw, categoryBySlug);
      const target = f.id ? byId.get(f.id) : bySlug.get(f.slug);
      if (f.id && !target) throw new Error(`No product has id ${f.id}`);

      if (target && claimedProducts.has(target.id)) throw new Error(`Duplicate: this product already appears in an earlier row`);
      if (!target && claimedSlugs.has(f.slug)) throw new Error(`Duplicate: slug "${f.slug}" already appears in an earlier row`);
      const slugOwner = bySlug.get(f.slug);
      if (target && slugOwner && slugOwner.id !== target.id) throw new Error(`slug "${f.slug}" already belongs to another product`);

      if (target) {
        const mrp = f.mrp ?? target.mrp;
        const price = f.price ?? target.price;
        if (price > mrp) throw new Error(`price (${price}) cannot exceed mrp (${mrp})`);

        if (!dryRun) {
          target.set({
            slug: f.slug,
            ...(f.titleEn || f.titleHi ? { title: { en: f.titleEn ?? target.title.en, hi: f.titleHi ?? target.title.hi } } : {}),
            ...(f.category ? { category: f.category } : {}),
            ...(f.brand !== undefined ? { brand: f.brand } : {}),
            ...(f.unit !== undefined ? { unit: f.unit } : {}),
            ...(f.mrp !== undefined ? { mrp: f.mrp } : {}),
            ...(f.price !== undefined ? { price: f.price } : {}),
            ...(f.stock !== undefined ? { stock: f.stock } : {}),
            ...(f.isActive !== undefined ? { isActive: f.isActive } : {}),
          });
          await target.save();
        }
        claimedProducts.add(target.id);
        updated += 1;
      } else {
        const missing = ['titleEn', 'titleHi', 'category', 'unit', 'mrp', 'price', 'stock'].filter((k) => f[k] === undefined);
        if (missing.length) {
          const names = { titleEn: 'title_en', titleHi: 'title_hi', category: 'category_slug' };
          throw new Error(`New product is missing: ${missing.map((k) => names[k] ?? k).join(', ')}`);
        }
        if (f.price > f.mrp) throw new Error(`price (${f.price}) cannot exceed mrp (${f.mrp})`);

        if (!dryRun) {
          await Product.create({
            slug: f.slug,
            title: { en: f.titleEn, hi: f.titleHi },
            description: { en: f.titleEn, hi: f.titleHi }, // placeholder: the CSV has no description column
            category: f.category,
            brand: f.brand ?? '',
            unit: f.unit,
            mrp: f.mrp,
            price: f.price,
            stock: f.stock,
            isActive: f.isActive ?? true,
          });
        }
        claimedSlugs.add(f.slug);
        created += 1;
      }
    } catch (err) {
      errors.push({ row, error: err.code === 11000 ? 'slug already exists' : err.message });
    }
  }

  return { created, updated, errors, dryRun };
}
