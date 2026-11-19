import { describe, it, expect, beforeEach } from '@jest/globals';
import { parse } from 'csv-parse/sync';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Product } from '../src/models/Product.js';
import { createAuthedUser, createCategory, createProduct, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

// Old files without the variant columns are still accepted by the import (see the variants tests); the export always writes all of them.
const HEADER = 'id,slug,title_en,title_hi,category_slug,brand,unit,mrp,price,stock,isActive';
const EXPORT_HEADER = 'id,variant_id,variant_label_en,variant_label_hi,sku,slug,title_en,title_hi,option_name_en,option_name_hi,category_slug,brand,unit,mrp,price,stock,isActive';

describe('Admin — bulk product update', () => {
  let adminH;
  let a;
  let b;
  let c;

  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
    const category = await createCategory();
    a = await createProduct(category, { slug: 'a', mrp: 10000, price: 8000, stock: 10 });
    b = await createProduct(category, { slug: 'b', mrp: 5000, price: 4000, stock: 5 });
    c = await createProduct(category, { slug: 'c', mrp: 2000, price: 1500, stock: 1 });
  });

  const bulk = (body, h = adminH) => request(app).patch(`${base}/admin/products/bulk`).set(h).send(body);
  const fresh = (p) => Product.findById(p.id).lean();

  it('updates price / mrp / stock / isActive on many products and returns { updated, failed }', async () => {
    const res = await bulk([
      { id: a.id, price: 7500, stock: 99 },
      { id: b.id, isActive: false },
      { id: c.id, mrp: 2500, price: 2400 },
    ]);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { updated: 3, failed: [] }, error: null });
    expect(await fresh(a)).toMatchObject({ price: 7500, mrp: 10000, stock: 99, isActive: true });
    expect(await fresh(b)).toMatchObject({ price: 4000, isActive: false });
    expect(await fresh(c)).toMatchObject({ mrp: 2500, price: 2400 });
  });

  it('checks price <= mrp on EVERY row against the final values, and applies the valid rows anyway', async () => {
    const res = await bulk([
      { id: a.id, price: 12000 }, // above the CURRENT mrp (10000)
      { id: b.id, mrp: 3000 }, // below the CURRENT price (4000)
      { id: c.id, mrp: 1000, price: 900 }, // fine together
      { id: a.id.replace(/.$/, (ch) => (ch === '0' ? '1' : '0')), price: 1 }, // no such product
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.failed).toEqual([
      { id: a.id, error: 'price (12000) cannot exceed mrp (10000)' },
      { id: b.id, error: 'price (4000) cannot exceed mrp (3000)' },
      expect.objectContaining({ error: 'Product not found' }),
    ]);
    expect(await fresh(a)).toMatchObject({ price: 8000 });
    expect(await fresh(b)).toMatchObject({ mrp: 5000 });
    expect(await fresh(c)).toMatchObject({ mrp: 1000, price: 900 });
  });

  it('validates each row on its own: bad ids, unknown keys, negatives, decimals, empty rows, duplicates', async () => {
    const res = await bulk([
      { id: 'not-an-id', price: 1 },
      { id: a.id, color: 'red' },
      { id: a.id, price: -1 },
      { id: b.id, stock: 1.5 },
      { id: b.id, isActive: 'yes' },
      { id: c.id },
      'not an object',
      { price: 5 },
      { id: a.id, stock: 20 }, // the only good one
      { id: a.id, stock: 30 }, // same id twice in one request
    ]);
    expect(res.status).toBe(200);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.failed).toHaveLength(9);
    expect(res.body.data.failed.map((f) => f.id)).toEqual(['not-an-id', a.id, a.id, b.id, b.id, c.id, null, null, a.id]);
    expect(res.body.data.failed[5].error).toMatch(/Nothing to update/);
    expect(res.body.data.failed[8].error).toMatch(/Duplicate id/);
    expect((await fresh(a)).stock).toBe(20);
    expect(await fresh(b)).toMatchObject({ stock: 5, isActive: true });
  });

  it('accepts up to 200 rows and rejects 0 rows, 201 rows, non-arrays and non-admins', async () => {
    const rows = (n) => Array.from({ length: n }, () => ({ id: a.id, stock: 1 }));
    expect((await bulk(rows(200))).status).toBe(200);
    for (const body of [[], rows(201), { id: a.id, price: 1 }, 'x', null]) {
      const res = await bulk(body);
      expect([JSON.stringify(body).slice(0, 30), res.status]).toEqual([JSON.stringify(body).slice(0, 30), 400]);
    }
    expect((await bulk([{ id: a.id, stock: 1 }], bearer(await createAuthedUser()))).status).toBe(403);
    expect((await bulk([{ id: a.id, stock: 1 }], {})).status).toBe(401);
  });

  it('is routed BEFORE /admin/products/:id (PATCH /products/bulk is not treated as an id)', async () => {
    const res = await bulk([{ id: a.id, stock: 3 }]);
    expect(res.status).toBe(200);
    // ...and the by-id route still works
    const byId = await request(app).patch(`${base}/admin/products/${a.id}`).set(adminH).send({ stock: 4 });
    expect(byId.status).toBe(200);
    expect(byId.body.data.stock).toBe(4);
  });
});

describe('Admin — product CSV export / import', () => {
  let adminH;
  let grocery;
  let dairy;
  let atta;
  let milk;

  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
    grocery = await createCategory({ slug: 'grocery', name: { en: 'Grocery', hi: 'किराना' } });
    dairy = await createCategory({ slug: 'dairy', name: { en: 'Dairy', hi: 'डेयरी' } });
    atta = await createProduct(grocery, {
      slug: 'atta-5kg',
      title: { en: 'Atta, "Premium" 5kg', hi: 'आटा' },
      brand: 'Aashirvaad',
      unit: '5 kg',
      mrp: 27500,
      price: 24900,
      stock: 80,
    });
    milk = await createProduct(dairy, { slug: 'milk', title: { en: 'Milk', hi: 'दूध' }, brand: 'Amul', unit: '500 ml', mrp: 3000, price: 2800, stock: 40, isActive: false });
  });

  const exportCsv = (h = adminH) => request(app).get(`${base}/admin/products/export`).set(h).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on('data', (d) => chunks.push(d));
    res.on('end', () => cb(null, Buffer.concat(chunks).toString('utf8')));
  });
  const doImport = (csv, { query = '', filename = 'products.csv', type = 'text/csv', field = 'file', h = adminH } = {}) =>
    request(app)
      .post(`${base}/admin/products/import${query}`)
      .set(h)
      .attach(field, Buffer.isBuffer(csv) ? csv : Buffer.from(csv, 'utf8'), { filename, contentType: type });

  // ------------------------------------------------------------------ export
  describe('GET /admin/products/export', () => {
    it('downloads every product (inactive too) as an Excel-friendly CSV in the documented columns', async () => {
      const res = await exportCsv();
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/^text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/^attachment; filename="products-\d{4}-\d{2}-\d{2}\.csv"$/);
      expect(res.body.startsWith('﻿')).toBe(true); // BOM so Excel shows Hindi correctly
      expect(res.body.split('\r\n')[0].replace('﻿', '')).toBe(EXPORT_HEADER);

      const rows = parse(res.body, { bom: true, columns: true });
      expect(rows).toHaveLength(2);
      const byslug = Object.fromEntries(rows.map((r) => [r.slug, r]));
      expect(byslug['atta-5kg']).toEqual({
        id: atta.id,
        variant_id: '',
        variant_label_en: '',
        variant_label_hi: '',
        sku: '',
        option_name_en: '',
        option_name_hi: '',
        slug: 'atta-5kg',
        title_en: 'Atta, "Premium" 5kg', // comma and quotes survive
        title_hi: 'आटा',
        category_slug: 'grocery',
        brand: 'Aashirvaad',
        unit: '5 kg',
        mrp: '27500', // paise
        price: '24900',
        stock: '80',
        isActive: 'true',
      });
      expect(byslug.milk).toMatchObject({ category_slug: 'dairy', isActive: 'false', price: '2800' });
    });

    it('is admin-only', async () => {
      expect((await exportCsv(bearer(await createAuthedUser()))).status).toBe(403);
      expect((await exportCsv({})).status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ import: happy paths
  describe('POST /admin/products/import', () => {
    it('updates by id, updates by slug (blank cells = unchanged), and creates new products', async () => {
      const csv = [
        HEADER,
        `${atta.id},atta-5kg,,आटा (गेहूं),,,,27500,23900,70,`, // by id: new price/stock/title_hi
        `,milk,,,,,,,,55,true`, // by slug: only stock + reactivate
        ',new-rice,Basmati Rice,बासमती चावल,grocery,India Gate,1 kg,12000,10500,30,',
        ',old-biscuit,Biscuit,बिस्कुट,dairy,Parle,200 g,2000,1800,9,false',
      ].join('\r\n');

      const res = await doImport(csv);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ created: 2, updated: 2, errors: [], dryRun: false });

      expect(await Product.findById(atta.id).lean()).toMatchObject({ price: 23900, stock: 70, mrp: 27500, title: { en: 'Atta, "Premium" 5kg', hi: 'आटा (गेहूं)' }, brand: 'Aashirvaad' });
      expect(await Product.findById(milk.id).lean()).toMatchObject({ stock: 55, isActive: true, price: 2800, title: { en: 'Milk', hi: 'दूध' } });

      const rice = await Product.findOne({ slug: 'new-rice' }).lean();
      expect(rice).toMatchObject({
        title: { en: 'Basmati Rice', hi: 'बासमती चावल' },
        description: { en: 'Basmati Rice', hi: 'बासमती चावल' }, // placeholder: the CSV has no description column
        brand: 'India Gate',
        unit: '1 kg',
        mrp: 12000,
        price: 10500,
        stock: 30,
        isActive: true, // default
      });
      expect(rice.category.toString()).toBe(grocery.id);
      expect(await Product.findOne({ slug: 'old-biscuit' }).lean()).toMatchObject({ isActive: false });
    });

    it('dryRun=true validates and counts but writes NOTHING', async () => {
      const before = await Product.find().lean();
      const csv = [
        HEADER,
        `${atta.id},atta-5kg,,,,,,,20000,1,`,
        ',brand-new,Thing,चीज़,grocery,,1 pc,100,90,5,',
        ',bad-row,Thing,चीज़,nowhere,,1 pc,100,90,5,',
      ].join('\n');
      const res = await doImport(csv, { query: '?dryRun=true' });
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ created: 1, updated: 1, errors: [{ row: 4, error: expect.stringContaining('nowhere') }], dryRun: true });
      expect(await Product.find().lean()).toEqual(before);
      expect(await Product.countDocuments()).toBe(2);

      // dryRun=false is the same as leaving it out: it writes
      expect((await doImport(csv, { query: '?dryRun=false' })).body.data).toMatchObject({ created: 1, updated: 1, dryRun: false });
      expect(await Product.countDocuments()).toBe(3);
    });

    it('reports every bad row with its spreadsheet row number (header = row 1) while applying the good ones', async () => {
      const csv = [
        HEADER,
        ',ok-one,One,एक,grocery,,1 pc,100,90,5,', // row 2: fine
        `${atta.id},atta-5kg,,,,,,100,200,,`, // row 3: price 200 > mrp 100
        ',no-unit,Name,नाम,grocery,,,100,90,5,', // row 4: new product missing unit
        ',bad-cat,Name,नाम,nowhere,,1 pc,100,90,5,', // row 5: unknown category
        ',decimal,Name,नाम,grocery,,1 pc,100,49.5,5,', // row 6: decimal
        ',negative,Name,नाम,grocery,,1 pc,100,-5,5,', // row 7: sign
        'xyz,some-slug,,,,,,,,1,', // row 8: id is not an id
        '507f1f77bcf86cd799439011,ghost,,,,,,,,1,', // row 9: id valid but nothing has it
        `${atta.id},milk,,,,,,,,,`, // row 10: slug belongs to ANOTHER product
        ',ok-one,Dup,डुप,grocery,,1 pc,100,90,5,', // row 11: same slug as row 2
        `${atta.id},atta-5kg,,,,,,,,5,`, // row 12: fine - row 3 FAILED, so it did not claim this product
        ',maybe,Name,नाम,grocery,,1 pc,100,90,5,maybe', // row 13: isActive
        ',Bad Slug!,Name,नाम,grocery,,1 pc,100,90,5,', // row 14: slug characters
        ',,Name,नाम,grocery,,1 pc,100,90,5,', // row 15: slug missing
        `${atta.id},atta-5kg,,,,,,,,6,`, // row 16: same product as row 12, which succeeded
      ].join('\n');

      const res = await doImport(csv);
      expect(res.status).toBe(200);
      expect(res.body.data.created).toBe(1);
      expect(res.body.data.updated).toBe(1); // row 12
      const msg = Object.fromEntries(res.body.data.errors.map((e) => [e.row, e.error]));
      expect(Object.keys(msg).map(Number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16]);
      expect(msg[3]).toMatch(/price \(200\) cannot exceed mrp \(100\)/);
      expect(msg[4]).toMatch(/missing: unit/);
      expect(msg[5]).toMatch(/category_slug "nowhere" does not exist/);
      expect(msg[6]).toMatch(/price must be a whole number/);
      expect(msg[7]).toMatch(/price must be a whole number/);
      expect(msg[8]).toMatch(/id "xyz" is not a valid id/);
      expect(msg[9]).toMatch(/No product has id/);
      expect(msg[10]).toMatch(/already belongs to another product/);
      expect(msg[11]).toMatch(/Duplicate: slug "ok-one"/);
      expect(msg[13]).toMatch(/isActive must be true or false/);
      expect(msg[14]).toMatch(/slug may only contain/);
      expect(msg[15]).toMatch(/slug is required/);
      expect(msg[16]).toMatch(/Duplicate: this product already appears/);

      expect(await Product.findOne({ slug: 'ok-one' })).not.toBeNull(); // the good row was still applied
      expect(await Product.findById(atta.id).lean()).toMatchObject({ price: 24900, stock: 5 }); // row 3 (bad price) was not applied; row 12 (stock) was; row 16 was a duplicate
      expect(await Product.countDocuments()).toBe(3);
    });

    it('round trip: exporting and importing the same file changes nothing', async () => {
      const before = await Product.find().sort({ slug: 1 }).lean();
      const exported = (await exportCsv()).body;
      const res = await doImport(exported);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ created: 0, updated: 2, errors: [], dryRun: false });
      expect(await Product.find().sort({ slug: 1 }).lean()).toEqual(before);
    });

    it('copes with Excel-style files: BOM, CRLF, quoted commas / quotes / line breaks, padded headers, blank lines', async () => {
      const csv =
        '﻿' +
        [
          ' id , slug ,title_en,title_hi,category_slug,brand,unit,mrp,price,stock,isActive',
          '',
          ',quoted,"Tea, ""Gold""",चाय,dairy,"Tata\nTea",250 g,5000,4500,7,TRUE',
          '',
        ].join('\r\n');
      const res = await doImport(csv, { type: 'application/vnd.ms-excel' }); // what Excel on Windows sends
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ created: 1, errors: [] });
      expect(await Product.findOne({ slug: 'quoted' }).lean()).toMatchObject({ title: { en: 'Tea, "Gold"', hi: 'चाय' }, brand: 'Tata\nTea', isActive: true });
    });

    it('takes up to 2000 rows and refuses 2001', async () => {
      const rows = (n) => Array.from({ length: n }, (_, i) => `,bulk-${i},T${i},ट${i},grocery,,1 pc,100,90,5,`);
      const ok = await doImport([HEADER, ...rows(2000)].join('\n'), { query: '?dryRun=true' });
      expect(ok.status).toBe(200);
      expect(ok.body.data.created).toBe(2000);
      const tooMany = await doImport([HEADER, ...rows(2001)].join('\n'), { query: '?dryRun=true' });
      expect([tooMany.status, tooMany.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    });
  });

  // ------------------------------------------------------------------ import: bad requests
  describe('import request validation', () => {
    const row = ',x,X,क्स,grocery,,1 pc,100,90,5,';

    it('rejects structural problems with 400 and writes nothing', async () => {
      const cases = [
        ['unknown column', `${HEADER},colour\n${row},red`, /Unknown column.*colour/],
        ['no slug column', 'id,title_en\n,Thing', /needs a "slug" column/],
        ['header only', HEADER, /no data rows/],
        ['empty file', '', /no data rows|could not be read/],
        ['malformed quoting', `${HEADER}\n,x,"unclosed,क्स,grocery,,1 pc,100,90,5,`, /could not be read/],
        ['ragged row', `${HEADER}\n,x,only,three`, /could not be read/],
      ];
      for (const [label, csv, pattern] of cases) {
        const res = await doImport(csv);
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
        expect([label, res.body.error.message]).toEqual([label, expect.stringMatching(pattern)]);
      }
      expect(await Product.countDocuments()).toBe(2);
    });

    it('requires exactly one .csv in the multipart field "file", max 2 MB', async () => {
      expect((await doImport(`${HEADER}\n${row}`, { filename: 'products.xlsx' })).status).toBe(400);
      expect((await doImport(`${HEADER}\n${row}`, { filename: 'products.csv', type: 'image/png' })).status).toBe(400);
      expect((await doImport(`${HEADER}\n${row}`, { field: 'upload' })).status).toBe(400);
      const none = await request(app).post(`${base}/admin/products/import`).set(adminH);
      expect([none.status, none.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);

      const big = await doImport(Buffer.alloc(2 * 1024 * 1024 + 1, 'a'));
      expect([big.status, big.body.error.code]).toEqual([413, 'FILE_TOO_LARGE']);
      // exactly 2 MB gets past the size check (and then fails as unreadable CSV content, not as too large)
      const exact = await doImport(Buffer.alloc(2 * 1024 * 1024, 'a'));
      expect(exact.status).not.toBe(413);
    });

    it('rejects a bad dryRun value and unknown query params; is admin-only', async () => {
      expect((await doImport(`${HEADER}\n${row}`, { query: '?dryRun=maybe' })).status).toBe(400);
      expect((await doImport(`${HEADER}\n${row}`, { query: '?foo=1' })).status).toBe(400);
      expect((await doImport(`${HEADER}\n${row}`, { h: bearer(await createAuthedUser()) })).status).toBe(403);
      expect((await doImport(`${HEADER}\n${row}`, { h: {} })).status).toBe(401);
      expect(await Product.countDocuments()).toBe(2);
    });
  });
});
