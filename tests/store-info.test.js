import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { createAuthedUser, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Store info (legal pages, invoice, contact)', () => {
  let adminH;
  let customerH;

  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
    customerH = bearer(await createAuthedUser());
  });

  const patch = (body, h = adminH) => request(app).patch(`${base}/admin/settings`).set(h).send(body);
  const pub = () => request(app).get(`${base}/settings`);

  const info = {
    storeName: 'Aali Market, Sitapur',
    phone: '+91 98765 43210',
    whatsapp: '9876543210',
    email: 'Hello@AaliMarket.in',
    address: { line1: '12 Station Road', city: 'Sitapur', state: 'Uttar Pradesh', pincode: '261001' },
    fssaiNumber: '12345678901234',
    gstin: '09aabcu9603r1zx',
  };

  it('are blank/defaulted at first, and public', async () => {
    const res = await pub(); // no token
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      storeName: 'Aali Market',
      phone: '',
      whatsapp: '',
      email: '',
      address: { line1: '', city: '', state: '', pincode: '' },
      fssaiNumber: '',
      gstin: '',
    });
  });

  it('PATCH /admin/settings saves them; GET /settings and GET /admin/settings return them (email lower-cased, GSTIN upper-cased)', async () => {
    const res = await patch(info);
    expect(res.status).toBe(200);
    const expected = { ...info, email: 'hello@aalimarket.in', gstin: '09AABCU9603R1ZX' };
    expect(res.body.data).toMatchObject(expected);
    expect((await pub()).body.data).toMatchObject(expected);
    expect((await request(app).get(`${base}/admin/settings`).set(adminH)).body.data).toMatchObject(expected);
  });

  it('merges a partial address instead of replacing it, and leaves unrelated settings alone', async () => {
    await patch(info);
    const res = await patch({ address: { city: 'Lucknow' }, deliveryFee: 4000 });
    expect(res.body.data.address).toEqual({ line1: '12 Station Road', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '261001' });
    expect(res.body.data.deliveryFee).toBe(4000);
    expect(res.body.data.gstin).toBe('09AABCU9603R1ZX');
  });

  it('a field can be cleared with ""', async () => {
    await patch(info);
    const res = await patch({ whatsapp: '', gstin: '', address: { pincode: '' } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ whatsapp: '', gstin: '', address: { pincode: '' }, phone: '+91 98765 43210' });
  });

  it('validates formats strictly (and rejects unknown keys, also inside address)', async () => {
    const bad = [
      { phone: 'call me' },
      { whatsapp: '12' },
      { email: 'not-an-email' },
      { gstin: '123' },
      { gstin: '09AABCU9603R1Z' }, // 14 chars
      { fssaiNumber: '1234567890123' }, // 13 digits
      { fssaiNumber: 'ABCDEFGHIJKLMN' },
      { address: { pincode: '12' } },
      { address: { pincode: '012345' } },
      { address: { country: 'India' } },
      { storeName: '' },
      { storeName: 'x'.repeat(101) },
      { website: 'https://aalimarket.in' },
    ];
    for (const body of bad) {
      const res = await patch(body);
      expect([body, res.status]).toEqual([body, 400]);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    // nothing above was saved
    expect((await pub()).body.data.phone).toBe('');
  });

  it('only admins may change them', async () => {
    expect((await patch({ phone: '9876543210' }, customerH)).status).toBe(403);
    expect((await patch({ phone: '9876543210' }, {})).status).toBe(401);
    expect((await pub()).body.data.phone).toBe('');
  });
});
