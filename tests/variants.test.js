import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Product } from '../src/models/Product.js';
import { Cart } from '../src/models/Cart.js';
import { Order } from '../src/models/Order.js';
import { createAuthedUser, createCategory, createProduct, createAddress, bearer, adminSetStatus } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

const variant = (en, hi, price, mrp, stock, extra = {}) => ({ label: { en, hi }, mrp, price, stock, ...extra });
const AATA = () => [
  variant('1 kg', '1 किलो', 5000, 6000, 20, { sku: 'AATA-1', isDefault: true }),
  variant('5 kg', '5 किलो', 22000, 27500, 10, { sku: 'AATA-5' }),
  variant('10 kg', '10 किलो', 41000, 55000, 4, { sku: 'AATA-10', images: ['https://cdn.example.com/aata-10kg.jpg'] }),
];

describe('Product variants', () => {
  let admin;
  let adminH;
  let customer;
  let customerH;
  let address;
  let category;

  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
    customer = await createAuthedUser();
    customerH = bearer(customer);
    address = await createAddress(customer.user);
    category = await createCategory();
  });

  const productBody = (over = {}) => ({
    title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' },
    slug: `aata-${Math.random().toString(36).slice(2)}`,
    description: { en: 'Whole wheat flour', hi: 'गेहूं का आटा' },
    category: category.id,
    images: ['https://cdn.example.com/aata.jpg'],
    optionName: { en: 'Pack size', hi: 'पैक साइज़' },
    variants: AATA(),
    ...over,
  });
  const createVariantProduct = async (over = {}) => {
    const res = await request(app).post(`${base}/admin/products`).set(adminH).send(productBody(over));
    expect(res.status).toBe(201);
    return res.body.data;
  };
  const vid = (p, label) => p.variants.find((v) => v.label.en === label).id;
  const addToCart = (productId, variantId, qty = 1, h = customerH) =>
    request(app).post(`${base}/cart/items`).set(h).send({ productId, ...(variantId ? { variantId } : {}), qty });
  const checkout = (key = `k-${Math.random()}`, h = customerH, paymentMethod = 'cod') =>
    request(app).post(`${base}/orders`).set(h).set('Idempotency-Key', key).send({ addressId: address.id, paymentMethod });

  // ================================================================== admin create / update
  describe('POST /admin/products with variants', () => {
    it('stores them and derives price / mrp / unit / stock from the default variant and the active variants', async () => {
      const p = await createVariantProduct();
      expect(p.optionName).toEqual({ en: 'Pack size', hi: 'पैक साइज़' });
      expect(p.variants).toHaveLength(3);
      expect(p.variants[0]).toEqual({
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        label: { en: '1 kg', hi: '1 किलो' },
        sku: 'AATA-1',
        mrp: 6000,
        price: 5000,
        stock: 20,
        images: [],
        isDefault: true,
        isActive: true,
        discountPercent: 17,
        inStock: true,
      });
      expect(p.variants[2].images).toEqual(['https://cdn.example.com/aata-10kg.jpg']);
      // derived
      expect([p.price, p.mrp, p.unit, p.stock]).toEqual([5000, 6000, '1 kg', 34]);
      expect(p.discountPercent).toBe(17);
      expect(p.variants.every((v) => !('_id' in v))).toBe(true);
    });

    it('ignores top-level price / mrp / unit / stock when variants are given', async () => {
      const p = await createVariantProduct({ price: 1, mrp: 2, unit: 'junk', stock: 999 });
      expect([p.price, p.mrp, p.unit, p.stock]).toEqual([5000, 6000, '1 kg', 34]);
    });

    it('does not count inactive variants in the total stock', async () => {
      const variants = AATA();
      variants[2].isActive = false;
      const p = await createVariantProduct({ variants });
      expect(p.stock).toBe(30);
    });

    it('rejects broken variant sets with 400 VALIDATION_ERROR', async () => {
      const bad = {
        'duplicate English label': { variants: [variant('1 kg', 'एक', 100, 200, 1, { isDefault: true }), variant('1 KG', 'दो', 100, 200, 1)] },
        'duplicate Hindi label': { variants: [variant('1 kg', 'एक', 100, 200, 1, { isDefault: true }), variant('2 kg', 'एक', 100, 200, 1)] },
        'duplicate sku': { variants: [variant('1 kg', 'एक', 100, 200, 1, { isDefault: true, sku: 'X' }), variant('2 kg', 'दो', 100, 200, 1, { sku: 'x' })] },
        'no default': { variants: [variant('1 kg', 'एक', 100, 200, 1), variant('2 kg', 'दो', 100, 200, 1)] },
        'two defaults': { variants: [variant('1 kg', 'एक', 100, 200, 1, { isDefault: true }), variant('2 kg', 'दो', 100, 200, 1, { isDefault: true })] },
        'inactive default': { variants: [variant('1 kg', 'एक', 100, 200, 1, { isDefault: true, isActive: false })] },
        'variant price above mrp': { variants: [variant('1 kg', 'एक', 300, 200, 1, { isDefault: true })] },
        'negative stock': { variants: [variant('1 kg', 'एक', 100, 200, -1, { isDefault: true })] },
        'decimal price': { variants: [variant('1 kg', 'एक', 99.5, 200, 1, { isDefault: true })] },
        'unknown variant key': { variants: [{ ...variant('1 kg', 'एक', 100, 200, 1, { isDefault: true }), colour: 'red' }] },
        'variant id on create': { variants: [{ ...variant('1 kg', 'एक', 100, 200, 1, { isDefault: true }), id: new mongoose.Types.ObjectId().toString() }] },
        'missing optionName': { optionName: undefined },
        'null optionName': { optionName: null },
        'missing Hindi label': { variants: [{ label: { en: '1 kg' }, mrp: 200, price: 100, stock: 1, isDefault: true }] },
        'more than 20 variants': {
          variants: Array.from({ length: 21 }, (_, i) => variant(`${i} kg`, `${i} किलो`, 100, 200, 1, { isDefault: i === 0 })),
        },
      };
      for (const [label, over] of Object.entries(bad)) {
        const res = await request(app).post(`${base}/admin/products`).set(adminH).send(productBody(over));
        expect([label, res.status, res.body.error?.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
      }
      expect(await Product.countDocuments()).toBe(0);
    });

    it('accepts exactly 20 variants', async () => {
      const variants = Array.from({ length: 20 }, (_, i) => variant(`${i + 1} kg`, `${i + 1} किलो`, 100, 200, 1, { isDefault: i === 0 }));
      expect((await createVariantProduct({ variants })).variants).toHaveLength(20);
    });

    it('still requires price / mrp / unit / stock for a plain product (and price <= mrp)', async () => {
      const plain = productBody({ variants: undefined, optionName: undefined });
      const missing = await request(app).post(`${base}/admin/products`).set(adminH).send(plain);
      expect(missing.status).toBe(400);
      expect(missing.body.error.details.map((d) => d.path).sort()).toEqual(['mrp', 'price', 'stock', 'unit']);

      const ok = await request(app).post(`${base}/admin/products`).set(adminH).send({ ...plain, mrp: 100, price: 90, unit: '1 pc', stock: 3 });
      expect(ok.status).toBe(201);
      expect(ok.body.data.variants).toEqual([]);
      expect(ok.body.data.optionName).toBeNull();
      const dear = await request(app).post(`${base}/admin/products`).set(adminH).send({ ...plain, slug: 'x-y', mrp: 100, price: 190, unit: '1 pc', stock: 3 });
      expect(dear.status).toBe(400);
    });
  });

  describe('PATCH /admin/products/:id — variants', () => {
    const patch = (id, body) => request(app).patch(`${base}/admin/products/${id}`).set(adminH).send(body);
    const asBody = (v) => ({
      id: v.id,
      label: v.label,
      sku: v.sku,
      mrp: v.mrp,
      price: v.price,
      stock: v.stock,
      images: v.images,
      isDefault: v.isDefault,
      isActive: v.isActive,
    });

    it('updates variants that carry an id (keeping their ids) and re-derives the product fields', async () => {
      const p = await createVariantProduct();
      const [v1, v5, v10] = p.variants.map(asBody);
      const res = await patch(p.id, { variants: [{ ...v1, price: 5500, stock: 7 }, v5, v10] });
      expect(res.status).toBe(200);
      expect(res.body.data.variants.map((v) => v.id)).toEqual([v1.id, v5.id, v10.id]);
      expect([res.body.data.price, res.body.data.stock]).toEqual([5500, 21]);
    });

    it('creates variants without an id and DELETES the ones left out', async () => {
      const p = await createVariantProduct();
      const [v1, , v10] = p.variants.map(asBody);
      const res = await patch(p.id, { variants: [v1, v10, variant('25 kg', '25 किलो', 90000, 120000, 2)] });
      expect(res.status).toBe(200);
      expect(res.body.data.variants.map((v) => v.label.en)).toEqual(['1 kg', '10 kg', '25 kg']);
      expect(res.body.data.variants[0].id).toBe(v1.id);
      expect(res.body.data.variants[2].id).not.toBe(p.variants[1].id);
      expect(res.body.data.stock).toBe(26);
    });

    it('moving the default to another variant changes the product price / unit', async () => {
      const p = await createVariantProduct();
      const [v1, v5, v10] = p.variants.map(asBody);
      const res = await patch(p.id, { variants: [{ ...v1, isDefault: false }, { ...v5, isDefault: true }, v10] });
      expect([res.body.data.price, res.body.data.mrp, res.body.data.unit]).toEqual([22000, 27500, '5 kg']);
    });

    it('404 VARIANT_NOT_FOUND for an id that is not one of this product\'s; 400 for broken lists', async () => {
      const p = await createVariantProduct();
      const other = await createVariantProduct();
      const foreign = asBody(other.variants[0]);
      const res = await patch(p.id, { variants: [foreign] });
      expect([res.status, res.body.error.code]).toEqual([404, 'VARIANT_NOT_FOUND']);

      const [v1, v5] = p.variants.map(asBody);
      expect((await patch(p.id, { variants: [v1, { ...v5, isDefault: true }] })).status).toBe(400); // two defaults
      expect((await patch(p.id, { variants: [v1, { ...v5, label: v1.label, id: v5.id }] })).status).toBe(400); // same label
      expect((await patch(p.id, { variants: [v1, v1] })).status).toBe(400); // same id twice
      expect((await patch(p.id, { variants: [{ ...v1, price: 99999 }] })).status).toBe(400); // price > mrp
      // nothing of that was applied
      expect((await Product.findById(p.id)).variants).toHaveLength(3);
    });

    it('omitting `variants` leaves them alone; top-level price / stock sent with variants are ignored', async () => {
      const p = await createVariantProduct();
      const res = await patch(p.id, { brand: 'Aashirvaad', price: 1, stock: 0, mrp: 5000 });
      expect(res.status).toBe(200);
      expect(res.body.data.variants).toHaveLength(3);
      expect([res.body.data.price, res.body.data.mrp, res.body.data.stock]).toEqual([5000, 6000, 34]);
    });

    it('`variants: []` turns it back into a plain product that takes price / mrp / unit / stock again', async () => {
      const p = await createVariantProduct();
      const res = await patch(p.id, { variants: [], mrp: 7000, price: 6500, unit: '1 kg', stock: 12 });
      expect(res.status).toBe(200);
      expect(res.body.data.variants).toEqual([]);
      expect(res.body.data.optionName).toBeNull();
      expect([res.body.data.price, res.body.data.mrp, res.body.data.stock]).toEqual([6500, 7000, 12]);
    });

    it('turns a plain product into one with variants', async () => {
      const plain = await createProduct(category, { price: 8000, mrp: 10000, stock: 5, unit: '1 pc' });
      const res = await patch(plain.id, { optionName: { en: 'Size', hi: 'आकार' }, variants: AATA() });
      expect(res.status).toBe(200);
      expect([res.body.data.price, res.body.data.stock, res.body.data.unit]).toEqual([5000, 34, '1 kg']);
    });

    it('also rejects price > mrp on a plain product PATCH', async () => {
      const plain = await createProduct(category, { price: 8000, mrp: 10000 });
      expect((await patch(plain.id, { price: 12000 })).status).toBe(400);
    });
  });

  // ================================================================== storefront
  describe('storefront JSON', () => {
    it('list, detail, related and wishlist carry optionName + variants; inactive variants are hidden from customers', async () => {
      const variants = AATA();
      variants[1].isActive = false;
      const p = await createVariantProduct({ variants });
      const sibling = await createVariantProduct();

      const list = await request(app).get(`${base}/products`).query({ category: category.id });
      const listed = list.body.data.find((x) => x.id === p.id);
      expect(listed.optionName.en).toBe('Pack size');
      expect(listed.variants.map((v) => v.label.en)).toEqual(['1 kg', '10 kg']);

      const detail = await request(app).get(`${base}/products/${p.slug}`);
      expect(detail.body.data.variants.map((v) => v.label.en)).toEqual(['1 kg', '10 kg']);
      expect(detail.body.data.variants[0]).toEqual(expect.objectContaining({ discountPercent: 17, inStock: true, isDefault: true }));

      const related = await request(app).get(`${base}/products/${sibling.id}/related`);
      expect(related.body.data.find((x) => x.id === p.id).variants).toHaveLength(2);

      await request(app).post(`${base}/wishlist/${p.id}`).set(customerH);
      const wish = await request(app).get(`${base}/wishlist`).set(customerH);
      expect(wish.body.data.products[0].variants.map((v) => v.label.en)).toEqual(['1 kg', '10 kg']);

      // the admin list shows ALL of them
      const adminList = await request(app).get(`${base}/admin/products`).set(adminH);
      expect(adminList.body.data.find((x) => x.id === p.id).variants).toHaveLength(3);
    });

    it('sorting, price filters and suggest work off the derived (default variant) price', async () => {
      const cheap = await createProduct(category, { price: 2000, mrp: 2500, title: { en: 'Atta cheap', hi: 'सस्ता' } });
      const p = await createVariantProduct({ title: { en: 'Atta Premium', hi: 'प्रीमियम आटा' } });
      const asc = await request(app).get(`${base}/products`).query({ category: category.id, sort: 'price_asc' });
      expect(asc.body.data.map((x) => x.id)).toEqual([cheap.id, p.id]);
      const filtered = await request(app).get(`${base}/products`).query({ minPrice: 4000, maxPrice: 6000 });
      expect(filtered.body.data.map((x) => x.id)).toEqual([p.id]);
      const stock = await request(app).get(`${base}/products`).query({ inStock: 'true', sort: 'discount' });
      expect(stock.body.data.map((x) => x.id)).toContain(p.id);
      const suggest = await request(app).get(`${base}/products/suggest`).query({ q: 'premi' });
      expect(suggest.body.data[0]).toEqual(expect.objectContaining({ id: p.id, price: 5000 }));
    });

    it('a product whose variants are all out of stock is not "inStock"', async () => {
      const variants = AATA().map((v) => ({ ...v, stock: 0 }));
      const p = await createVariantProduct({ variants });
      expect(p.inStock).toBe(false);
      expect(p.variants.every((v) => v.inStock === false)).toBe(true);
    });
  });

  // ================================================================== cart
  describe('cart', () => {
    it('400 VARIANT_REQUIRED without variantId (listing the choices); 404 VARIANT_NOT_FOUND for unknown / inactive / foreign ones', async () => {
      const variants = AATA();
      variants[2].isActive = false;
      const p = await createVariantProduct({ variants });
      const other = await createVariantProduct();

      const none = await addToCart(p.id);
      expect([none.status, none.body.error.code]).toEqual([400, 'VARIANT_REQUIRED']);
      expect(none.body.error.details.options.map((o) => o.label.en)).toEqual(['1 kg', '5 kg']);

      for (const [label, id] of [['unknown', new mongoose.Types.ObjectId().toString()], ['inactive', p.variants[2].id], ['foreign', other.variants[0].id]]) {
        const res = await addToCart(p.id, id);
        expect([label, res.status, res.body.error.code]).toEqual([label, 404, 'VARIANT_NOT_FOUND']);
      }
      // a plain product has no variants to pick
      const plain = await createProduct(category);
      expect((await addToCart(plain.id, p.variants[0].id)).body.error.code).toBe('VARIANT_NOT_FOUND');
      expect((await addToCart(plain.id)).status).toBe(201);
    });

    it('keeps different variants of one product as separate lines, each with its own price / mrp / stock / image / label', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '1 kg'), 2);
      const res = await addToCart(p.id, vid(p, '10 kg'), 1);
      expect(res.status).toBe(201);
      const items = res.body.data.items;
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual(
        expect.objectContaining({
          productId: p.id,
          variantId: vid(p, '1 kg'),
          variantLabel: { en: '1 kg', hi: '1 किलो' },
          unit: '1 kg',
          price: 5000,
          mrp: 6000,
          stock: 20,
          qty: 2,
          lineTotal: 10000,
          isAvailable: true,
          inStock: true,
          image: 'https://cdn.example.com/aata.jpg', // the variant has none: the product's
        })
      );
      expect(items[1]).toEqual(
        expect.objectContaining({ variantLabel: { en: '10 kg', hi: '10 किलो' }, price: 41000, mrp: 55000, stock: 4, image: 'https://cdn.example.com/aata-10kg.jpg' })
      );
      expect(res.body.data.pricing.subtotal).toBe(10000 + 41000);

      // same variant again merges into the line
      const again = await addToCart(p.id, vid(p, '1 kg'), 3);
      expect(again.body.data.items.find((i) => i.variantId === vid(p, '1 kg')).qty).toBe(5);
      expect(again.body.data.items).toHaveLength(2);
    });

    it('plain products show variantId / variantLabel as null', async () => {
      const plain = await createProduct(category);
      const res = await addToCart(plain.id, undefined, 1);
      expect(res.body.data.items[0]).toEqual(expect.objectContaining({ variantId: null, variantLabel: null }));
    });

    it('PATCH / DELETE /cart/items/:productId?variantId= address exactly one line', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '1 kg'), 2);
      await addToCart(p.id, vid(p, '5 kg'), 1);

      const patched = await request(app).patch(`${base}/cart/items/${p.id}`).query({ variantId: vid(p, '5 kg') }).set(customerH).send({ qty: 4 });
      expect(patched.status).toBe(200);
      expect(patched.body.data.items.map((i) => [i.variantLabel.en, i.qty])).toEqual([['1 kg', 2], ['5 kg', 4]]);

      const noVariant = await request(app).patch(`${base}/cart/items/${p.id}`).set(customerH).send({ qty: 9 });
      expect(noVariant.status).toBe(404); // there is no variant-less line for this product

      const removed = await request(app).delete(`${base}/cart/items/${p.id}`).query({ variantId: vid(p, '1 kg') }).set(customerH);
      expect(removed.body.data.items.map((i) => i.variantLabel.en)).toEqual(['5 kg']);

      const bad = await request(app).delete(`${base}/cart/items/${p.id}`).query({ variantId: 'nope' }).set(customerH);
      expect(bad.status).toBe(400);
    });

    it('a variant that was switched off or deleted turns its line unavailable (and out of the totals)', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '1 kg'), 1);
      await addToCart(p.id, vid(p, '5 kg'), 1);
      const [v1, v5, v10] = p.variants.map(({ id, ...v }) => ({ id, ...v, discountPercent: undefined, inStock: undefined }));
      const clean = (v) => ({ id: v.id, label: v.label, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, images: v.images, isDefault: v.isDefault, isActive: v.isActive });
      await request(app).patch(`${base}/admin/products/${p.id}`).set(adminH).send({ variants: [clean(v1), { ...clean(v5), isActive: false }, clean(v10)] });

      const cart = await request(app).get(`${base}/cart`).set(customerH);
      const line5 = cart.body.data.items.find((i) => i.variantId === vid(p, '5 kg'));
      expect([line5.isAvailable, line5.lineTotal]).toEqual([false, 0]);
      expect(cart.body.data.pricing.subtotal).toBe(5000);
      expect((await checkout()).body.error.code).toBe('OUT_OF_STOCK');

      // deleted entirely
      await request(app).patch(`${base}/admin/products/${p.id}`).set(adminH).send({ variants: [clean(v1), clean(v10)] });
      const after = await request(app).get(`${base}/cart`).set(customerH);
      const gone = after.body.data.items.find((i) => i.variantId === vid(p, '5 kg'));
      expect([gone.isAvailable, gone.variantLabel]).toEqual([false, null]);
    });

    it('a cart line from before the product had variants cannot be bought, but can be removed', async () => {
      const plain = await createProduct(category, { price: 8000, mrp: 10000, stock: 5 });
      await addToCart(plain.id, undefined, 1);
      await request(app).patch(`${base}/admin/products/${plain.id}`).set(adminH).send({ optionName: { en: 'Size', hi: 'आकार' }, variants: AATA() });

      const cart = await request(app).get(`${base}/cart`).set(customerH);
      expect([cart.body.data.items[0].isAvailable, cart.body.data.items[0].variantId]).toEqual([false, null]);
      expect((await checkout()).body.error.code).toBe('OUT_OF_STOCK');
      const removed = await request(app).delete(`${base}/cart/items/${plain.id}`).set(customerH);
      expect(removed.body.data.items).toEqual([]);
    });

    it('applies a coupon on the variant prices', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '5 kg'), 1);
      const { Coupon } = await import('../src/models/Coupon.js');
      await Coupon.create({ code: 'FLAT10', type: 'flat', value: 1000, minOrderValue: 20000, isActive: true, startsAt: new Date(Date.now() - 86400000), expiresAt: new Date(Date.now() + 86400000) });
      const res = await request(app).post(`${base}/cart/coupon`).set(customerH).send({ code: 'FLAT10' });
      expect(res.status).toBe(200);
      expect(res.body.data.pricing.discount).toBe(1000);
    });
  });

  // ================================================================== orders
  describe('orders', () => {
    it('snapshots the variant, takes stock from THAT variant only and re-derives the product total', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '5 kg'), 3);
      const res = await checkout();
      expect(res.status).toBe(201);
      expect(res.body.data.items[0]).toEqual(
        expect.objectContaining({
          variantId: vid(p, '5 kg'),
          variantLabel: { en: '5 kg', hi: '5 किलो' },
          unit: '5 kg',
          price: 22000,
          qty: 3,
          title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' },
        })
      );
      expect(res.body.data.pricing.subtotal).toBe(66000);

      const stored = await Product.findById(p.id);
      expect(stored.variants.map((v) => [v.label.en, v.stock])).toEqual([['1 kg', 20], ['5 kg', 7], ['10 kg', 4]]);
      expect(stored.stock).toBe(31);
    });

    it('cancel puts the units back into the same variant', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '10 kg'), 2);
      await addToCart(p.id, vid(p, '1 kg'), 5);
      const order = await checkout();
      expect((await Product.findById(p.id)).stock).toBe(34 - 7);

      const cancel = await request(app).post(`${base}/orders/${order.body.data.id}/cancel`).set(customerH).send({});
      expect(cancel.status).toBe(200);
      const stored = await Product.findById(p.id);
      expect(stored.variants.map((v) => v.stock)).toEqual([20, 10, 4]);
      expect(stored.stock).toBe(34);
    });

    it('cancel after the variant was switched off restores its stock but not the (active-only) total; after deletion it is a no-op', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '10 kg'), 2);
      const order = await checkout();
      const clean = (v) => ({ id: v.id, label: v.label, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, images: v.images, isDefault: v.isDefault, isActive: v.isActive });
      const current = (await request(app).get(`${base}/admin/products`).set(adminH)).body.data.find((x) => x.id === p.id).variants.map(clean);

      await request(app).patch(`${base}/admin/products/${p.id}`).set(adminH).send({ variants: current.map((v) => (v.label.en === '10 kg' ? { ...v, isActive: false } : v)) });
      await request(app).post(`${base}/orders/${order.body.data.id}/cancel`).set(customerH).send({});
      const stored = await Product.findById(p.id);
      expect(stored.variants.find((v) => v.label.en === '10 kg').stock).toBe(4); // 2 left + 2 back
      expect(stored.stock).toBe(30); // 1 kg + 5 kg only

      const order2 = await (async () => {
        await request(app).patch(`${base}/admin/products/${p.id}`).set(adminH).send({ variants: current.map((v) => ({ ...v, isActive: true })) });
        await addToCart(p.id, vid(p, '5 kg'), 1);
        return checkout();
      })();
      await request(app).patch(`${base}/admin/products/${p.id}`).set(adminH).send({ variants: current.filter((v) => v.label.en !== '5 kg') });
      const cancel = await request(app).post(`${base}/orders/${order2.body.data.id}/cancel`).set(customerH).send({});
      expect(cancel.status).toBe(200);
      expect((await Product.findById(p.id)).variants).toHaveLength(2);
    });

    it('INSUFFICIENT_STOCK names the variant and its remaining stock', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '10 kg'), 5); // only 4
      const res = await checkout();
      expect([res.status, res.body.error.code]).toEqual([400, 'INSUFFICIENT_STOCK']);
      expect(res.body.error.message).toMatch(/10 kg/);
      expect(res.body.error.details).toEqual({ productId: p.id, variantId: vid(p, '10 kg'), available: 4 });
      expect((await Product.findById(p.id)).stock).toBe(34); // nothing was taken
    });

    it('two customers racing for the last unit of a variant: exactly one wins, stock never goes negative', async () => {
      const p = await createVariantProduct({ variants: [variant('1 kg', '1 किलो', 5000, 6000, 1, { isDefault: true }), variant('5 kg', '5 किलो', 22000, 27500, 10)] });
      const rival = await createAuthedUser();
      const rivalAddress = await createAddress(rival.user);
      await addToCart(p.id, vid(p, '1 kg'), 1, customerH);
      await addToCart(p.id, vid(p, '1 kg'), 1, bearer(rival));

      const results = await Promise.all([
        checkout('race-a', customerH),
        request(app).post(`${base}/orders`).set(bearer(rival)).set('Idempotency-Key', 'race-b').send({ addressId: rivalAddress.id, paymentMethod: 'cod' }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
      const stored = await Product.findById(p.id);
      expect(stored.variants[0].stock).toBe(0);
      expect(stored.stock).toBe(10);
    });

    it('placing the same checkout twice (Idempotency-Key) takes the variant stock once', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '5 kg'), 2);
      const a = await checkout('same-key');
      const b = await checkout('same-key');
      expect(b.body.data.id).toBe(a.body.data.id);
      expect((await Product.findById(p.id)).variants[1].stock).toBe(8);
    });

    it('reorder: re-adds the same variant; skips it as "inactive" when it is gone and as qty_reduced / out_of_stock by stock', async () => {
      const p = await createVariantProduct();
      await addToCart(p.id, vid(p, '5 kg'), 4);
      await addToCart(p.id, vid(p, '10 kg'), 3);
      const order = (await checkout()).body.data;
      await adminSetStatus(app, base, admin, order.id, 'delivered');

      // 5 kg: only 2 left; 10 kg: deleted
      const clean = (v) => ({ id: v.id, label: v.label, sku: v.sku, mrp: v.mrp, price: v.price, stock: v.stock, images: v.images, isDefault: v.isDefault, isActive: v.isActive });
      const current = (await request(app).get(`${base}/admin/products`).set(adminH)).body.data.find((x) => x.id === p.id).variants.map(clean);
      await request(app)
        .patch(`${base}/admin/products/${p.id}`)
        .set(adminH)
        .send({ variants: current.filter((v) => v.label.en !== '10 kg').map((v) => (v.label.en === '5 kg' ? { ...v, stock: 2 } : v)) });

      const res = await request(app).post(`${base}/orders/${order.id}/reorder`).set(customerH).send();
      expect(res.status).toBe(200);
      expect(res.body.data.cart.items).toHaveLength(1);
      expect(res.body.data.cart.items[0]).toEqual(expect.objectContaining({ variantId: vid(p, '5 kg'), variantLabel: { en: '5 kg', hi: '5 किलो' }, qty: 2 }));
      expect(res.body.data.skipped).toEqual([
        { productId: p.id, variantId: vid(p, '5 kg'), variantLabel: { en: '5 kg', hi: '5 किलो' }, title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' }, reason: 'qty_reduced', requested: 4, added: 2 },
        { productId: p.id, variantId: vid(p, '10 kg'), variantLabel: { en: '10 kg', hi: '10 किलो' }, title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' }, reason: 'inactive', requested: 3, added: 0 },
      ]);

      // a second reorder: the 5 kg line is already at the stock limit -> out_of_stock
      const again = await request(app).post(`${base}/orders/${order.id}/reorder`).set(customerH).send();
      expect(again.body.data.skipped.find((s) => s.variantId === vid(p, '5 kg')).reason).toBe('out_of_stock');
    });
  });

  // ================================================================== reports
  describe('reports: top products', () => {
    it('gives every variant its own row, with its label; plain products show null', async () => {
      const p = await createVariantProduct();
      const plain = await createProduct(category, { title: { en: 'Tea', hi: 'चाय' }, price: 3000, mrp: 3500 });
      await addToCart(p.id, vid(p, '1 kg'), 2);
      await addToCart(p.id, vid(p, '5 kg'), 1);
      await addToCart(plain.id, undefined, 1);
      await checkout();
      await addToCart(p.id, vid(p, '1 kg'), 3);
      await checkout();

      const res = await request(app).get(`${base}/admin/reports/top-products`).set(adminH);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        { productId: p.id, variantId: vid(p, '1 kg'), variantLabel: { en: '1 kg', hi: '1 किलो' }, title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' }, qtySold: 5, revenue: 25000 },
        { productId: p.id, variantId: vid(p, '5 kg'), variantLabel: { en: '5 kg', hi: '5 किलो' }, title: { en: 'Aashirvaad Atta', hi: 'आशीर्वाद आटा' }, qtySold: 1, revenue: 22000 },
        { productId: plain.id, variantId: null, variantLabel: null, title: { en: 'Tea', hi: 'चाय' }, qtySold: 1, revenue: 3000 },
      ].sort((a, b) => b.qtySold - a.qtySold || b.revenue - a.revenue));
    });
  });

  // ================================================================== low stock
  describe('low stock (variant level)', () => {
    it('lowStock=true lists a product when ANY active variant is at/below the threshold; stats count it once', async () => {
      const t = env.lowStockThreshold;
      const fine = await createVariantProduct({ title: { en: 'Fine', hi: 'ठीक' }, variants: [variant('1 kg', '1', 100, 200, t + 50, { isDefault: true }), variant('2 kg', '2', 100, 200, t + 50)] });
      const oneLow = await createVariantProduct({ title: { en: 'One low', hi: 'एक कम' }, variants: [variant('1 kg', '1', 100, 200, t + 50, { isDefault: true }), variant('2 kg', '2', 100, 200, t), variant('3 kg', '3', 100, 200, 0)] });
      const inactiveLow = await createVariantProduct({ title: { en: 'Inactive low', hi: 'x' }, variants: [variant('1 kg', '1', 100, 200, t + 50, { isDefault: true }), variant('2 kg', '2', 100, 200, 0, { isActive: false })] });
      const plainLow = await createProduct(category, { stock: t });
      const plainFine = await createProduct(category, { stock: t + 1 });

      const list = await request(app).get(`${base}/admin/products`).query({ lowStock: 'true', limit: 100 }).set(adminH);
      const ids = list.body.data.map((x) => x.id).sort();
      expect(ids).toEqual([oneLow.id, plainLow.id].sort());
      expect(ids).not.toContain(fine.id);
      expect(ids).not.toContain(inactiveLow.id);
      expect(ids).not.toContain(plainFine.id);

      const stats = await request(app).get(`${base}/admin/stats`).set(adminH);
      expect(stats.body.data.lowStockCount).toBe(2);

      // combines with the search box
      const both = await request(app).get(`${base}/admin/products`).query({ lowStock: 'true', q: 'one low' }).set(adminH);
      expect(both.body.data.map((x) => x.id)).toEqual([oneLow.id]);
    });
  });

  // ================================================================== bulk PATCH
  describe('PATCH /admin/products/bulk — variantId', () => {
    const bulk = (rows) => request(app).patch(`${base}/admin/products/bulk`).set(adminH).send(rows);

    it('changes one variant per row and re-derives the product; rows for several variants of a product all apply', async () => {
      const p = await createVariantProduct();
      const res = await bulk([
        { id: p.id, variantId: vid(p, '1 kg'), price: 5200, stock: 8 },
        { id: p.id, variantId: vid(p, '5 kg'), stock: 0, isActive: true },
      ]);
      expect(res.body.data).toEqual({ updated: 2, failed: [] });
      const stored = await Product.findById(p.id);
      expect(stored.variants.map((v) => [v.price, v.stock])).toEqual([[5200, 8], [22000, 0], [41000, 4]]);
      expect([stored.price, stored.stock]).toEqual([5200, 12]);
    });

    it('checks price <= mrp on the final variant values, refuses to switch the default off and reports unknown variants', async () => {
      const p = await createVariantProduct();
      const plain = await createProduct(category);
      const res = await bulk([
        { id: p.id, variantId: vid(p, '5 kg'), price: 99999 },
        { id: p.id, variantId: vid(p, '1 kg'), isActive: false },
        { id: p.id, variantId: new mongoose.Types.ObjectId().toString(), stock: 1 },
        { id: plain.id, variantId: vid(p, '1 kg'), stock: 1 },
        { id: p.id, variantId: vid(p, '10 kg'), stock: 9 },
      ]);
      expect(res.body.data.updated).toBe(1);
      expect(res.body.data.failed).toEqual([
        { id: p.id, variantId: vid(p, '5 kg'), error: 'price (99999) cannot exceed mrp (27500)' },
        { id: p.id, variantId: vid(p, '1 kg'), error: expect.stringMatching(/default variant must stay active/) },
        { id: p.id, variantId: expect.any(String), error: 'Variant not found' },
        { id: plain.id, variantId: vid(p, '1 kg'), error: 'This product has no variants' },
      ]);
    });

    it('a row without variantId on a variant product may only switch the product on/off; the same variant twice is a duplicate', async () => {
      const p = await createVariantProduct();
      const priced = await bulk([{ id: p.id, price: 100 }]);
      expect(priced.body.data).toEqual({ updated: 0, failed: [{ id: p.id, error: 'This product has variants: send variantId to change price, mrp or stock' }] });

      const res = await bulk([
        { id: p.id, isActive: false },
        { id: p.id, variantId: vid(p, '1 kg'), stock: 1 },
        { id: p.id, variantId: vid(p, '1 kg'), stock: 2 },
      ]);
      expect(res.body.data.updated).toBe(2);
      expect(res.body.data.failed).toEqual([{ id: p.id, variantId: vid(p, '1 kg'), error: 'Duplicate id in this request' }]);
      const stored = await Product.findById(p.id);
      expect([stored.isActive, stored.variants[0].stock]).toEqual([false, 1]);
    });
  });

  // ================================================================== CSV
  describe('CSV export / import with variants', () => {
    const exportCsv = async () => (await request(app).get(`${base}/admin/products/export`).set(adminH).buffer(true).parse((r, cb) => { let d = ''; r.setEncoding('utf8'); r.on('data', (c) => (d += c)); r.on('end', () => cb(null, d)); })).body;
    const importCsv = (csv, dryRun) =>
      request(app)
        .post(`${base}/admin/products/import${dryRun ? '?dryRun=true' : ''}`)
        .set(adminH)
        .attach('file', Buffer.from(csv, 'utf8'), 'products.csv');
    const HEADER = 'id,variant_id,variant_label_en,variant_label_hi,sku,slug,title_en,title_hi,option_name_en,option_name_hi,category_slug,brand,unit,mrp,price,stock,isActive';

    it('exports one row per variant (product columns repeated) and one row for a plain product', async () => {
      const p = await createVariantProduct({ slug: 'aata' });
      const plain = await createProduct(category, { slug: 'plain-tea', price: 3000, mrp: 3500, stock: 4, unit: '250 g' });
      const lines = (await exportCsv()).replace(/^﻿/, '').trim().split('\r\n');
      expect(lines[0]).toBe(HEADER);
      expect(lines).toHaveLength(1 + 3 + 1);
      expect(lines[1]).toBe(`${p.id},${vid(p, '1 kg')},1 kg,1 किलो,AATA-1,aata,Aashirvaad Atta,आशीर्वाद आटा,Pack size,पैक साइज़,${category.slug},,1 kg,6000,5000,20,true`);
      expect(lines[2]).toContain(`${p.id},${vid(p, '5 kg')},5 kg,5 किलो,AATA-5,aata,`);
      expect(lines[4]).toBe(`${plain.id},,,,,plain-tea,Test Product,टेस्ट प्रोडक्ट,,,${category.slug},TestBrand,250 g,3500,3000,4,true`);
    });

    it('round trip: importing the export changes nothing', async () => {
      const p = await createVariantProduct({ slug: 'aata' });
      await createProduct(category, { slug: 'plain-tea' });
      const before = JSON.stringify((await Product.findById(p.id)).toJSON());
      const res = await importCsv(await exportCsv());
      expect(res.body.data).toEqual({ created: 0, updated: 2, errors: [], dryRun: false });
      expect(JSON.stringify((await Product.findById(p.id)).toJSON())).toBe(before);
    });

    it('updates variants by variant_id and by English label; blank cells stay unchanged; the product is re-derived', async () => {
      const p = await createVariantProduct({ slug: 'aata' });
      const csv = [
        HEADER,
        `${p.id},${vid(p, '1 kg')},,,,aata,,,,,,,,,5100,3,`, // by variant_id: price + stock
        `,,5 KG,,,aata,,,,,,,,,,0,false`, // by label (case-insensitive), by slug: stock 0 + switch off
      ].join('\r\n');
      const res = await importCsv(csv);
      expect(res.body.data).toEqual({ created: 0, updated: 1, errors: [], dryRun: false });
      const stored = await Product.findById(p.id);
      expect(stored.variants.map((v) => [v.price, v.stock, v.isActive])).toEqual([[5100, 3, true], [22000, 0, false], [41000, 4, true]]);
      expect([stored.price, stored.stock]).toEqual([5100, 7]);
    });

    it('adds a new variant to an existing product', async () => {
      const p = await createVariantProduct({ slug: 'aata' });
      const csv = [HEADER, `${p.id},,25 kg,25 किलो,AATA-25,aata,,,,,,,,100000,90000,6,`].join('\r\n');
      const res = await importCsv(csv);
      expect(res.body.data).toEqual({ created: 0, updated: 1, errors: [], dryRun: false });
      const stored = await Product.findById(p.id);
      expect(stored.variants).toHaveLength(4);
      expect(stored.variants[3]).toEqual(expect.objectContaining({ sku: 'AATA-25', mrp: 100000, price: 90000, stock: 6, isDefault: false, isActive: true }));
    });

    it('creates a NEW product with variants from variant rows: first = default, derived fields set, placeholder description', async () => {
      const csv = [
        HEADER,
        `,,500 g,500 ग्राम,,new-poha,Poha,पोहा,Pack size,पैक साइज़,${category.slug},Desi,,3000,2500,10,`,
        `,,1 kg,1 किलो,,new-poha,Poha,पोहा,Pack size,पैक साइज़,${category.slug},Desi,,5500,4800,0,`,
      ].join('\r\n');
      const res = await importCsv(csv);
      expect(res.body.data).toEqual({ created: 1, updated: 0, errors: [], dryRun: false });
      const stored = await Product.findOne({ slug: 'new-poha' });
      expect(stored.optionName.toObject()).toEqual({ en: 'Pack size', hi: 'पैक साइज़' });
      expect(stored.variants.map((v) => [v.label.en, v.isDefault, v.stock])).toEqual([['500 g', true, 10], ['1 kg', false, 0]]);
      expect([stored.price, stored.mrp, stored.unit, stored.stock]).toEqual([2500, 3000, '500 g', 10]);
      expect(stored.description.en).toBe('Poha');
    });

    it('reports bad variant rows by row number and applies the rest', async () => {
      const p = await createVariantProduct({ slug: 'aata' });
      const csv = [
        HEADER,
        `${p.id},${vid(p, '1 kg')},,,,aata,,,,,,,,,,9,`, // 2 ok
        `${p.id},${new mongoose.Types.ObjectId()},,,,aata,,,,,,,,,,9,`, // 3 unknown variant id
        `${p.id},,2 kg,,,aata,,,,,,,,6000,5000,1,`, // 4 new variant missing hi label
        `${p.id},,5 kg,,,aata,,,,,,,,1000,2000,1,`, // 5 price > mrp
        `${p.id},${vid(p, '1 kg')},,,,aata,,,,,,,,,,,false`, // 6 default cannot be switched off
        `${p.id},${vid(p, '10 kg')},1 kg,,,aata,,,,,,,,,,,`, // 7 label collides with another variant
        `${p.id},,,,x-sku,aata,,,,,,,,,,,`, // 8 sku without a variant
        `${p.id},,,,,aata,,,,,,,,,3000,,`, // 9 plain row on a variant product with a price
        `${p.id},${vid(p, '5 kg')},,,AATA-1,aata,,,,,,,,,,,`, // 10 sku already used
      ].join('\r\n');
      const res = await importCsv(csv);
      const msg = Object.fromEntries(res.body.data.errors.map((e) => [e.row, e.error]));
      expect(res.body.data.updated).toBe(1);
      expect(msg[3]).toMatch(/No variant has id/);
      expect(msg[4]).toMatch(/New variant is missing: variant_label_hi/);
      expect(msg[5]).toMatch(/price \(2000\) cannot exceed mrp \(1000\)/);
      expect(msg[6]).toMatch(/default variant must stay active/);
      expect(msg[7]).toMatch(/Another variant already has the label/);
      expect(msg[8]).toMatch(/sku belongs to a variant/);
      expect(msg[9]).toMatch(/product has variants/);
      expect(msg[10]).toMatch(/sku "AATA-1" is used by another variant/);
      expect(Object.keys(msg).map(Number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10]);
      expect((await Product.findById(p.id)).variants[0].stock).toBe(9);
    });

    it('a new variant product needs option names; dryRun writes nothing', async () => {
      const noOption = [HEADER, `,,1 kg,1 किलो,,opt-less,Rice,चावल,,,${category.slug},,,100,50,1,`].join('\r\n');
      const res = await importCsv(noOption);
      expect(res.body.data.created).toBe(0);
      expect(res.body.data.errors[0]).toEqual({ row: 2, error: expect.stringMatching(/option_name_en and option_name_hi/) });

      const ok = [HEADER, `,,1 kg,1 किलो,,dry-rice,Rice,चावल,Size,आकार,${category.slug},,,100,50,1,`].join('\r\n');
      const dry = await importCsv(ok, true);
      expect(dry.body.data).toEqual({ created: 1, updated: 0, errors: [], dryRun: true });
      expect(await Product.countDocuments({ slug: 'dry-rice' })).toBe(0);
    });

    it('two plain rows for one product are still a duplicate', async () => {
      const csv = [HEADER, `,,,,,dup-tea,Tea,चाय,,,${category.slug},,1 pc,100,50,1,`, `,,,,,dup-tea,Tea,चाय,,,${category.slug},,1 pc,100,50,1,`].join('\r\n');
      const res = await importCsv(csv);
      expect(res.body.data).toMatchObject({ created: 1, errors: [{ row: 3, error: expect.stringMatching(/Duplicate/) }] });
    });

    it('still accepts a CSV in the OLD column layout (no variant columns)', async () => {
      const plain = await createProduct(category, { slug: 'old-layout', price: 3000, mrp: 3500, stock: 4 });
      const csv = ['id,slug,title_en,title_hi,category_slug,brand,unit,mrp,price,stock,isActive', `${plain.id},old-layout,,,,,,,2800,9,`].join('\r\n');
      const res = await importCsv(csv);
      expect(res.body.data).toEqual({ created: 0, updated: 1, errors: [], dryRun: false });
      expect((await Product.findById(plain.id)).stock).toBe(9);
    });
  });

  // ================================================================== backwards compatibility
  describe('data from before variants existed', () => {
    it('a product document without optionName / variants reads as a plain product', async () => {
      const _id = new mongoose.Types.ObjectId();
      await Product.collection.insertOne({
        _id,
        title: { en: 'Old Salt', hi: 'पुराना नमक' },
        slug: 'old-salt',
        description: { en: 'd', hi: 'd' },
        category: category._id,
        brand: '',
        images: [],
        mrp: 3000,
        price: 2500,
        unit: '1 kg',
        stock: 12,
        ratingAvg: 0,
        ratingCount: 0,
        tags: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const detail = await request(app).get(`${base}/products/old-salt`);
      expect(detail.status).toBe(200);
      expect(detail.body.data).toEqual(expect.objectContaining({ optionName: null, variants: [], price: 2500, stock: 12 }));
      const list = await request(app).get(`${base}/products`).query({ category: category.id });
      expect(list.body.data[0]).toEqual(expect.objectContaining({ optionName: null, variants: [] }));

      // buy it the old way: no variantId anywhere
      const add = await addToCart(_id.toString());
      expect(add.status).toBe(201);
      expect(add.body.data.items[0]).toEqual(expect.objectContaining({ variantId: null, variantLabel: null, price: 2500 }));
      const order = await checkout();
      expect(order.status).toBe(201);
      expect((await Product.findById(_id)).stock).toBe(11);
      await request(app).post(`${base}/orders/${order.body.data.id}/cancel`).set(customerH).send({});
      expect((await Product.findById(_id)).stock).toBe(12);
    });

    it('a cart line and an order item stored without variant fields keep working (cart view, reorder, reports)', async () => {
      const plain = await createProduct(category, { price: 3000, mrp: 3500, stock: 10 });
      // raw documents exactly as the pre-variant code stored them: no variantId / variantLabel keys at all
      await Cart.collection.insertOne({
        user: customer.user._id,
        items: [{ product: plain._id, qty: 2, priceAtAdd: 3000 }],
        couponCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const cart = await request(app).get(`${base}/cart`).set(customerH);
      expect(cart.body.data.items[0]).toEqual(expect.objectContaining({ variantId: null, variantLabel: null, qty: 2, price: 3000, isAvailable: true }));
      expect((await checkout()).status).toBe(201);

      const legacyId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({
        _id: legacyId,
        orderNumber: 'AALI-LEGACY-1',
        user: customer.user._id,
        items: [{ product: plain._id, title: { en: 'Test Product', hi: 'टेस्ट' }, image: '', unit: '1 pc', price: 3000, qty: 4 }],
        pricing: { subtotal: 12000, discount: 0, deliveryFee: 0, handlingFee: 0, total: 12000 },
        shippingAddress: { line1: 'x', city: 'y', state: 'z', pincode: '110001' },
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        status: 'delivered',
        statusHistory: [],
        idempotencyKey: 'legacy-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const one = await request(app).get(`${base}/orders/${legacyId}`).set(customerH);
      expect(one.body.data.items[0]).toEqual(expect.objectContaining({ variantId: null, variantLabel: null }));

      const reorder = await request(app).post(`${base}/orders/${legacyId}/reorder`).set(customerH).send();
      expect(reorder.status).toBe(200);
      expect(reorder.body.data.cart.items[0]).toEqual(expect.objectContaining({ variantId: null, qty: 4 }));

      const top = await request(app).get(`${base}/admin/reports/top-products`).set(adminH);
      expect(top.body.data[0]).toEqual(expect.objectContaining({ productId: plain.id, variantId: null, variantLabel: null, qtySold: 6 }));
    });
  });
});
