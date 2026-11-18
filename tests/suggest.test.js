import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createCategory, createProduct } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const suggest = (q) => request(app).get(`${base}/products/suggest`).query({ q });

describe('GET /products/suggest — prefix search', () => {
  let cat;

  beforeEach(async () => {
    cat = await createCategory();
    await createProduct(cat, {
      title: { en: 'Aata (Whole Wheat Flour)', hi: 'आटा (गेहूं का आटा)' },
      slug: 'aata',
      tags: ['atta', 'flour'],
      brand: 'Aashirvaad',
      price: 24900,
      images: ['https://cdn.test/aata.jpg'],
    });
    await createProduct(cat, { title: { en: 'Basmati Rice', hi: 'बासमती चावल' }, slug: 'basmati', brand: 'India Gate', tags: ['rice'], price: 57500 });
    await createProduct(cat, { title: { en: 'Atta Special (hidden)', hi: 'छिपा आटा' }, slug: 'hidden', tags: ['atta'], isActive: false });
  });

  it('"att" finds "Aata" through its "atta" tag — the case $text could not handle', async () => {
    const res = await suggest('att');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.map((p) => p.slug)).toEqual(['aata']);
  });

  it('returns exactly { id, slug, title, price, image } with the first image or ""', async () => {
    const [aata] = (await suggest('att')).body.data;
    expect(aata).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      slug: 'aata',
      title: { en: 'Aata (Whole Wheat Flour)', hi: 'आटा (गेहूं का आटा)' },
      price: 24900,
      image: 'https://cdn.test/aata.jpg',
    });
    const [rice] = (await suggest('basm')).body.data;
    expect(rice.image).toBe('');
  });

  it('matches the start of ANY word in the title, a brand word, and Hindi text; case-insensitive', async () => {
    expect((await suggest('whe')).body.data.map((p) => p.slug)).toEqual(['aata']); // "Wheat"
    expect((await suggest('FLOUR')).body.data.map((p) => p.slug)).toEqual(['aata']); // title word + tag
    expect((await suggest('gat')).body.data.map((p) => p.slug)).toEqual(['basmati']); // brand "India Gate"
    expect((await suggest('आट')).body.data.map((p) => p.slug)).toEqual(['aata']); // Hindi prefix
    expect((await suggest('चाव')).body.data.map((p) => p.slug)).toEqual(['basmati']);
  });

  it('does NOT match mid-word fragments, and excludes inactive products', async () => {
    expect((await suggest('mati')).body.data).toHaveLength(0); // inside "Basmati"
    expect((await suggest('hidden')).body.data).toHaveLength(0);
    expect((await suggest('zzz')).body.data).toEqual([]);
  });

  it('ranks title-prefix matches above word-in-title matches above brand/tag-only matches', async () => {
    await createProduct(cat, { title: { en: 'Rice Bran Oil', hi: 'राइस ब्रान तेल' }, slug: 'ricebran', tags: ['oil'] }); // title STARTS with "rice"
    await createProduct(cat, { title: { en: 'Fried Rice Masala', hi: 'मसाला' }, slug: 'friedrice', tags: [] }); // "rice" is a later word
    await createProduct(cat, { title: { en: 'Jasmine Grain', hi: 'चमेली दाना' }, slug: 'jasmine', tags: ['rice'] }); // matches via tag only
    const slugs = (await suggest('rice')).body.data.map((p) => p.slug);
    // basmati ("Basmati Rice") and friedrice are both word-in-title matches, so they tie and sit in the middle.
    expect(slugs[0]).toBe('ricebran');
    expect(slugs[slugs.length - 1]).toBe('jasmine');
    expect(slugs.slice(1, 3).sort()).toEqual(['basmati', 'friedrice']);
    expect(slugs).toHaveLength(4);
  });

  it('returns at most 8 results', async () => {
    for (let i = 0; i < 12; i += 1) {
      await createProduct(cat, { title: { en: `Lemon Drink ${i}`, hi: `नींबू ${i}` }, slug: `lemon-${i}` });
    }
    expect((await suggest('lem')).body.data).toHaveLength(8);
  });

  it('treats regex metacharacters as literal text instead of crashing', async () => {
    for (const q of ['.*', '[a-', 'a\\', '+++', '^', '$', '|', '?']) {
      const res = await suggest(q);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]); // none of these literals appear in any product
    }
    // "(" is a real character in "Aata (Whole Wheat Flour)": matched literally, not parsed as a regex group.
    const paren = await suggest('(');
    expect(paren.status).toBe(200);
    expect(paren.body.data.map((p) => p.slug)).toEqual(['aata']);
  });

  it('requires q (1-60 chars) and rejects unknown params', async () => {
    expect((await request(app).get(`${base}/products/suggest`)).status).toBe(400);
    expect((await suggest('')).status).toBe(400);
    expect((await suggest('x'.repeat(61))).status).toBe(400);
    expect((await request(app).get(`${base}/products/suggest?q=a&limit=50`)).status).toBe(400);
  });

  it('is not swallowed by GET /products/:slug (route order)', async () => {
    const res = await suggest('att');
    expect(Array.isArray(res.body.data)).toBe(true);
    // ...and the real slug route still works
    expect((await request(app).get(`${base}/products/aata`)).body.data.slug).toBe('aata');
  });
});
