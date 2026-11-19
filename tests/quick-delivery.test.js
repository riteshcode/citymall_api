import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { Pincode } from '../src/models/Pincode.js';
import { createAuthedUser, createCategory, createProduct, createAddress, placeOrder, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;

describe('Quick delivery: Pincode.etaMinutes', () => {
  let adminH;
  beforeEach(async () => {
    adminH = bearer(await createAuthedUser({ role: 'admin' }));
  });

  const area = { pincode: '201301', areaName: { en: 'Noida Sector 63', hi: 'नोएडा सेक्टर 63' } };
  const create = (body) => request(app).post(`${base}/admin/pincodes`).set(adminH).send(body);
  const patch = (id, body) => request(app).patch(`${base}/admin/pincodes/${id}`).set(adminH).send(body);
  const check = (pincode) => request(app).get(`${base}/serviceability`).query({ pincode });

  it('defaults to null; accepts 5..1440 whole minutes on create and PATCH, and null clears it', async () => {
    const plain = await create(area);
    expect(plain.status).toBe(201);
    expect(plain.body.data).toMatchObject({ etaDays: 2, etaMinutes: null });

    const quick = await create({ ...area, pincode: '201302', etaMinutes: 30 });
    expect(quick.body.data).toMatchObject({ etaMinutes: 30, etaDays: 2 });
    expect((await create({ ...area, pincode: '201303', etaMinutes: 5 })).status).toBe(201);
    expect((await create({ ...area, pincode: '201304', etaMinutes: 1440 })).status).toBe(201);

    expect((await patch(plain.body.data.id, { etaMinutes: 45 })).body.data.etaMinutes).toBe(45);
    expect((await patch(plain.body.data.id, { etaMinutes: null })).body.data.etaMinutes).toBeNull();
    expect((await patch(plain.body.data.id, { etaDays: 3 })).body.data).toMatchObject({ etaDays: 3, etaMinutes: null });
  });

  it('rejects out-of-range, fractional and non-numeric values (400)', async () => {
    const made = (await create(area)).body.data;
    for (const etaMinutes of [4, 0, -5, 1441, 30.5, '30', true]) {
      expect([etaMinutes, (await create({ ...area, pincode: '201399', etaMinutes })).status]).toEqual([etaMinutes, 400]);
      expect([etaMinutes, (await patch(made.id, { etaMinutes })).status]).toEqual([etaMinutes, 400]);
    }
    expect(await Pincode.countDocuments()).toBe(1);
  });

  it('is listed by GET /admin/pincodes', async () => {
    await create({ ...area, etaMinutes: 30 });
    const list = await request(app).get(`${base}/admin/pincodes`).set(adminH);
    expect(list.body.data[0]).toMatchObject({ pincode: '201301', etaMinutes: 30 });
  });

  it('GET /serviceability returns etaMinutes next to etaDays (null for normal areas, null when not serviceable / open mode)', async () => {
    expect((await check('201301')).body.data.etaMinutes).toBeNull(); // open mode: nothing configured yet
    await create({ ...area, etaMinutes: 30 });
    await create({ ...area, pincode: '226001', areaName: { en: 'Lucknow', hi: 'लखनऊ' }, etaDays: 2 });

    expect((await check('201301')).body.data).toEqual({
      pincode: '201301',
      serviceable: true,
      etaDays: 2,
      etaMinutes: 30,
      areaName: { en: 'Noida Sector 63', hi: 'नोएडा सेक्टर 63' },
      deliveryFee: env.pricing.deliveryFeePaise,
    });
    expect((await check('226001')).body.data).toMatchObject({ etaDays: 2, etaMinutes: null });
    expect((await check('110001')).body.data).toMatchObject({ serviceable: false, etaMinutes: null });
  });

  describe('expectedDeliveryAt', () => {
    let customer;
    let product;
    let place;

    beforeEach(async () => {
      customer = await createAuthedUser();
      product = await createProduct(await createCategory());
      place = async (pincode) => {
        const address = await createAddress(customer.user, { pincode });
        return (await placeOrder(app, base, customer, product, address._id.toString())).body.data;
      };
    });

    it('= order time + etaMinutes when the area has it', async () => {
      await create({ ...area, etaMinutes: 30 });
      const before = Date.now();
      const order = await place('201301');
      const after = Date.now();
      const eta = new Date(order.expectedDeliveryAt).getTime();
      expect(eta).toBeGreaterThanOrEqual(before + 30 * 60 * 1000 - 50);
      expect(eta).toBeLessThanOrEqual(after + 30 * 60 * 1000 + 50);
    });

    it('etaMinutes wins over etaDays; without it etaDays still applies (unchanged behaviour)', async () => {
      await create({ ...area, etaMinutes: 90, etaDays: 5 });
      await create({ ...area, pincode: '226001', areaName: { en: 'Lucknow', hi: 'लखनऊ' }, etaDays: 3 });

      const quick = await place('201301');
      expect(new Date(quick.expectedDeliveryAt).getTime() - new Date(quick.createdAt).getTime()).toBeLessThan(2 * 3600 * 1000);

      const slow = await place('226001');
      const days = (new Date(slow.expectedDeliveryAt).getTime() - new Date(slow.createdAt).getTime()) / (24 * 3600 * 1000);
      expect(days).toBeGreaterThan(2.99);
      expect(days).toBeLessThan(3.01);
    });

    it('open mode (no pincodes configured) keeps the 2-day default', async () => {
      const order = await place('110001');
      const days = (new Date(order.expectedDeliveryAt).getTime() - new Date(order.createdAt).getTime()) / (24 * 3600 * 1000);
      expect(days).toBeGreaterThan(1.99);
      expect(days).toBeLessThan(2.01);
    });
  });
});
