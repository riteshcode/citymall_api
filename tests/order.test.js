import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Product } from '../src/models/Product.js';
import { createAuthedUser, createCategory, createProduct, createAddress } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Orders — checkout, stock, idempotency', () => {
  let token;
  let user;
  let product;
  let addressId;

  beforeEach(async () => {
    const authed = await createAuthedUser();
    token = authed.accessToken;
    user = authed.user;
    const category = await createCategory();
    product = await createProduct(category, { price: 10000, mrp: 10000, stock: 3 });
    const address = await createAddress(user);
    addressId = address._id.toString();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function addToCart(qty) {
    return request(app).post(`${base}/cart/items`).set(auth()).send({ productId: product.id, qty });
  }

  it('requires an Idempotency-Key header', async () => {
    await addToCart(1);
    const res = await request(app).post(`${base}/orders`).set(auth()).send({ addressId, paymentMethod: 'cod' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('places an order, decrements stock, and clears the cart', async () => {
    await addToCart(2);

    const res = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'test-key-1')
      .send({ addressId, paymentMethod: 'cod' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('placed');
    expect(res.body.data.pricing.subtotal).toBe(20000);
    expect(res.body.data.items[0].qty).toBe(2);

    const updatedProduct = await Product.findById(product.id);
    expect(updatedProduct.stock).toBe(1); // 3 - 2

    const cartRes = await request(app).get(`${base}/cart`).set(auth());
    expect(cartRes.body.data.items).toHaveLength(0);
  });

  it('replays the same order for a repeated Idempotency-Key instead of creating a duplicate', async () => {
    await addToCart(1);

    const first = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'dup-key')
      .send({ addressId, paymentMethod: 'cod' });

    // Cart is empty now — a real client retry sends the identical request again.
    const second = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'dup-key')
      .send({ addressId, paymentMethod: 'cod' });

    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect(second.body.data.orderNumber).toBe(first.body.data.orderNumber);

    const updatedProduct = await Product.findById(product.id);
    expect(updatedProduct.stock).toBe(2); // decremented once, not twice
  });

  it('rejects checkout with INSUFFICIENT_STOCK when qty exceeds available stock', async () => {
    await addToCart(2);
    // Sell out the stock from under the cart between add and checkout.
    await Product.updateOne({ _id: product._id }, { stock: 1 });

    const res = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'stock-key')
      .send({ addressId, paymentMethod: 'cod' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');

    const untouchedProduct = await Product.findById(product.id);
    expect(untouchedProduct.stock).toBe(1); // transaction rolled back, no partial decrement
  });

  it('rejects checkout with CART_EMPTY when the cart has no items', async () => {
    const res = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'empty-key')
      .send({ addressId, paymentMethod: 'cod' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('rejects checkout with ADDRESS_NOT_FOUND for an address that does not belong to the user', async () => {
    await addToCart(1);
    const fakeAddressId = '507f1f77bcf86cd799439011';

    const res = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'addr-key')
      .send({ addressId: fakeAddressId, paymentMethod: 'cod' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('cancels a placed order and restores stock', async () => {
    await addToCart(2);
    const created = await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'cancel-key')
      .send({ addressId, paymentMethod: 'cod' });

    const cancelRes = await request(app)
      .post(`${base}/orders/${created.body.data.id}/cancel`)
      .set(auth())
      .send({ reason: 'Changed my mind' });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    const restoredProduct = await Product.findById(product.id);
    expect(restoredProduct.stock).toBe(3); // fully restored
  });

  it('lists the user\'s orders with pagination metadata', async () => {
    await addToCart(1);
    await request(app)
      .post(`${base}/orders`)
      .set(auth())
      .set('Idempotency-Key', 'list-key')
      .send({ addressId, paymentMethod: 'cod' });

    const res = await request(app).get(`${base}/orders`).set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });
});
