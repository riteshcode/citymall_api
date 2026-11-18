import { User } from '../src/models/User.js';
import { Category } from '../src/models/Category.js';
import { Product } from '../src/models/Product.js';
import { issueTokenPair } from '../src/services/auth.service.js';

let mobileCounter = 9000000000;

/** Creates a verified customer (or admin) and returns { user, accessToken, refreshToken }. */
export async function createAuthedUser({ role = 'customer', mobile } = {}) {
  const user = await User.create({
    mobile: mobile || String(mobileCounter++),
    name: role === 'admin' ? 'Aali Admin' : 'Test Customer',
    role,
    isVerified: true,
  });
  const { accessToken, refreshToken } = await issueTokenPair(user);
  return { user, accessToken, refreshToken };
}

export async function createCategory(overrides = {}) {
  return Category.create({
    name: { en: 'Test Category', hi: 'टेस्ट श्रेणी' },
    slug: `test-category-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    isActive: true,
    ...overrides,
  });
}

export async function createProduct(category, overrides = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return Product.create({
    title: { en: 'Test Product', hi: 'टेस्ट प्रोडक्ट' },
    slug: `test-product-${suffix}`,
    description: { en: 'A product used in tests', hi: 'परीक्षण के लिए एक उत्पाद' },
    category: category._id,
    brand: 'TestBrand',
    images: [],
    mrp: 10000,
    price: 8000,
    unit: '1 pc',
    stock: 50,
    tags: ['test'],
    isActive: true,
    ...overrides,
  });
}

export async function createAddress(user, overrides = {}) {
  user.addresses.push({
    label: 'Home',
    line1: '123 Test Street',
    city: 'Testville',
    state: 'Test State',
    pincode: '110001',
    isDefault: true,
    ...overrides,
  });
  await user.save();
  return user.addresses.at(-1);
}

/** Adds `product` to the user's cart and places an order. Returns the supertest response. */
export async function placeOrder(app, base, who, product, addressId, { key, paymentMethod = 'cod', qty = 1 } = {}) {
  const { default: request } = await import('supertest');
  const h = { Authorization: `Bearer ${who.accessToken}` };
  await request(app).post(`${base}/cart/items`).set(h).send({ productId: product.id, qty });
  return request(app)
    .post(`${base}/orders`)
    .set(h)
    .set('Idempotency-Key', key || `key-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    .send({ addressId, paymentMethod });
}

/** Store-local (IST) calendar date `daysAgo` days back, as YYYY-MM-DD — same convention as the API's from/to filters. */
export function istDate(daysAgo = 0) {
  return new Date(Date.now() + 330 * 60000 - daysAgo * 86400000).toISOString().slice(0, 10);
}
