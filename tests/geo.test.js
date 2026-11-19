import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { geoTransport, clearGeoCache } from '../src/services/geo.service.js';
import { createGeoLimiter } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const app = createApp();
const base = env.apiBasePath;

const jsonResponse = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

// What Nominatim returns for a point in Noida (shape of the real "jsonv2" + addressdetails answer)
const noida = {
  address: {
    neighbourhood: 'G Block',
    suburb: 'Sector 63',
    city: 'Noida',
    state_district: 'Gautam Buddha Nagar',
    state: 'Uttar Pradesh',
    postcode: '201 301',
    country: 'India',
    country_code: 'in',
  },
};

describe('GET /geo/reverse', () => {
  const saved = { provider: env.geo.provider, key: env.geo.googleApiKey, ua: env.geo.userAgent, interval: env.geo.nominatimMinIntervalMs, fetch: geoTransport.fetch };
  let fetchMock;

  beforeEach(() => {
    clearGeoCache();
    env.geo.provider = 'nominatim';
    env.geo.nominatimMinIntervalMs = 0;
    fetchMock = jest.fn(async () => jsonResponse(noida));
    geoTransport.fetch = fetchMock;
  });

  afterEach(() => {
    Object.assign(env.geo, { provider: saved.provider, googleApiKey: saved.key, userAgent: saved.ua, nominatimMinIntervalMs: saved.interval });
    geoTransport.fetch = saved.fetch;
    clearGeoCache();
  });

  const reverse = (lat, lng) => request(app).get(`${base}/geo/reverse`).query({ lat, lng });

  // ------------------------------------------------------------------ happy path
  it('is public and answers { pincode, area, city, state } (Nominatim)', async () => {
    const res = await reverse(28.6139, 77.2090);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { pincode: '201301', area: 'G Block, Sector 63', city: 'Noida', state: 'Uttar Pradesh' }, error: null });
  });

  it('calls Nominatim politely: identifying User-Agent, rounded coordinates, English names', async () => {
    env.geo.userAgent = 'AaliMarketTest/1.0 (ops@example.test)';
    await reverse(28.613912, 77.209034);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/reverse\?/);
    const q = new URL(url).searchParams;
    expect([q.get('lat'), q.get('lon'), q.get('format'), q.get('addressdetails'), q.get('accept-language')]).toEqual(['28.614', '77.209', 'jsonv2', '1', 'en']);
    expect(options.headers['User-Agent']).toBe('AaliMarketTest/1.0 (ops@example.test)');
  });

  it('falls back sensibly when OSM has little detail (village, no suburb)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ address: { village: 'Laharpur', county: 'Sitapur', state: 'Uttar Pradesh', postcode: '261135', country_code: 'in' } }));
    const res = await reverse(27.7, 80.9);
    expect(res.body.data).toEqual({ pincode: '261135', area: 'Laharpur', city: 'Laharpur', state: 'Uttar Pradesh' });
  });

  // ------------------------------------------------------------------ cache
  it('rounds to 3 decimals and caches: nearby points and repeats do not reach the provider again', async () => {
    await reverse(28.61391, 77.20901);
    await reverse(28.61402, 77.20899); // same 3-decimal cell (28.614, 77.209)
    await reverse(28.614, 77.209);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await reverse(28.7, 77.3); // a different cell
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('the cache lasts 24 hours', async () => {
    await reverse(28.6, 77.2);
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 23 * 3600 * 1000;
      await reverse(28.6, 77.2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      Date.now = () => realNow() + 25 * 3600 * 1000;
      await reverse(28.6, 77.2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      Date.now = realNow;
    }
  });

  it('a burst of requests for one spot makes ONE provider call', async () => {
    fetchMock.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30));
      return jsonResponse(noida);
    });
    const results = await Promise.all(Array.from({ length: 6 }, () => reverse(28.55, 77.1)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ------------------------------------------------------------------ 404s
  it('404 GEO_NOT_FOUND outside India (no provider call at all for points far outside)', async () => {
    const far = await reverse(51.5074, -0.1278); // London
    expect([far.status, far.body.error.code]).toEqual([404, 'GEO_NOT_FOUND']);
    expect(fetchMock).not.toHaveBeenCalled();

    // inside the rough box but in Nepal: the provider says country_code "np"
    fetchMock.mockResolvedValue(jsonResponse({ address: { city: 'Kathmandu', postcode: '44600', country_code: 'np' } }));
    const nepal = await reverse(27.7, 85.3);
    expect([nepal.status, nepal.body.error.code]).toEqual([404, 'GEO_NOT_FOUND']);
  });

  it('404 when there is no pincode, or nothing at that spot; the "nothing here" answer is cached too', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ address: { city: 'Somewhere', state: 'Bihar', country_code: 'in' } }));
    expect((await reverse(25.1, 85.1)).body.error.code).toBe('GEO_NOT_FOUND');
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unable to geocode' }));
    expect((await reverse(21.1, 81.1)).body.error.code).toBe('GEO_NOT_FOUND');
    fetchMock.mockClear();
    expect((await reverse(25.1, 85.1)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------------ provider trouble
  it('502 GEO_PROVIDER_ERROR when the provider fails (network, 429, 500, bad JSON) and that is NOT cached', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    const net = await reverse(26.1, 80.1);
    expect([net.status, net.body.error.code]).toEqual([502, 'GEO_PROVIDER_ERROR']);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 429));
    expect((await reverse(26.1, 80.1)).status).toBe(502);
    fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));
    expect((await reverse(26.1, 80.1)).status).toBe(502);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new Error('not json'); } });
    expect((await reverse(26.1, 80.1)).status).toBe(502);

    expect((await reverse(26.1, 80.1)).status).toBe(200); // recovered: the failures were not remembered
  });

  // ------------------------------------------------------------------ throttling (Nominatim: 1 request / second)
  it('spaces outbound Nominatim calls by the minimum interval, even when requests arrive together', async () => {
    env.geo.nominatimMinIntervalMs = 80;
    const times = [];
    fetchMock.mockImplementation(async () => {
      times.push(Date.now());
      return jsonResponse(noida);
    });
    const results = await Promise.all([reverse(28.1, 77.1), reverse(28.2, 77.2), reverse(28.3, 77.3), reverse(28.4, 77.4)]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(times).toHaveLength(4);
    for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(70); // 80 ms minus timer jitter
  });

  // ------------------------------------------------------------------ validation
  it('validates lat / lng: required, decimal numbers in range, no unknown params', async () => {
    const bad = [
      ['no params', {}],
      ['no lng', { lat: 28.6 }],
      ['not a number', { lat: 'abc', lng: 77.2 }],
      ['empty lat', { lat: '', lng: 77.2 }],
      ['lat > 90', { lat: 91, lng: 77.2 }],
      ['lng < -180', { lat: 28.6, lng: -181 }],
      ['exponent', { lat: '1e1', lng: 77.2 }],
      ['extra param', { lat: 28.6, lng: 77.2, zoom: 18 }],
    ];
    for (const [label, query] of bad) {
      const res = await request(app).get(`${base}/geo/reverse`).query(query);
      expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts negative-looking and integer values (they are then simply outside India -> 404)', async () => {
    expect((await reverse(-33, 151)).status).toBe(404);
    expect((await reverse(28, 77)).status).toBe(200);
  });

  // ------------------------------------------------------------------ Google
  describe('GEO_PROVIDER=google', () => {
    const google = {
      status: 'OK',
      results: [
        {
          address_components: [
            { long_name: 'G Block', short_name: 'G Block', types: ['neighborhood', 'political'] },
            { long_name: 'Sector 63', short_name: 'Sector 63', types: ['sublocality_level_1', 'sublocality', 'political'] },
            { long_name: 'Noida', short_name: 'Noida', types: ['locality', 'political'] },
            { long_name: 'Uttar Pradesh', short_name: 'UP', types: ['administrative_area_level_1', 'political'] },
            { long_name: 'India', short_name: 'IN', types: ['country', 'political'] },
            { long_name: '201301', short_name: '201301', types: ['postal_code'] },
          ],
        },
      ],
    };

    beforeEach(() => {
      env.geo.provider = 'google';
      env.geo.googleApiKey = 'test-google-key';
    });

    it('maps the address components', async () => {
      fetchMock.mockResolvedValue(jsonResponse(google));
      const res = await reverse(28.6139, 77.209);
      expect(res.body.data).toEqual({ pincode: '201301', area: 'G Block, Sector 63', city: 'Noida', state: 'Uttar Pradesh' });
      const url = new URL(fetchMock.mock.calls[0][0]);
      expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/geocode/json');
      expect(url.searchParams.get('latlng')).toBe('28.614,77.209');
      expect(url.searchParams.get('key')).toBe('test-google-key');
    });

    it('503 GEO_NOT_CONFIGURED without an API key; 404 for ZERO_RESULTS and for another country; 502 for REQUEST_DENIED', async () => {
      env.geo.googleApiKey = '';
      const none = await reverse(28.6, 77.2);
      expect([none.status, none.body.error.code]).toEqual([503, 'GEO_NOT_CONFIGURED']);
      env.geo.googleApiKey = 'test-google-key';

      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'ZERO_RESULTS', results: [] }));
      expect((await reverse(28.61, 77.21)).body.error.code).toBe('GEO_NOT_FOUND');

      const nepal = JSON.parse(JSON.stringify(google));
      nepal.results[0].address_components.find((c) => c.types.includes('country')).short_name = 'NP';
      fetchMock.mockResolvedValueOnce(jsonResponse(nepal));
      expect((await reverse(28.62, 77.22)).body.error.code).toBe('GEO_NOT_FOUND');

      fetchMock.mockResolvedValueOnce(jsonResponse({ status: 'REQUEST_DENIED', error_message: 'The provided API key is invalid.' }));
      const denied = await reverse(28.63, 77.23);
      expect([denied.status, denied.body.error.code]).toEqual([502, 'GEO_PROVIDER_ERROR']);
      expect(JSON.stringify(denied.body)).not.toMatch(/test-google-key|API key is invalid/); // provider details are not leaked
    });

    it('an unknown GEO_PROVIDER is 503 GEO_NOT_CONFIGURED', async () => {
      env.geo.provider = 'mapbox';
      expect((await reverse(28.6, 77.2)).body.error.code).toBe('GEO_NOT_CONFIGURED');
    });
  });

  // ------------------------------------------------------------------ per-IP limit
  it('the per-IP limiter (factory): the N+1st request in a minute is 429 RATE_LIMITED', async () => {
    const mini = express();
    mini.get('/geo', createGeoLimiter(3), (req, res) => res.json({ ok: true }));
    mini.use(errorHandler);
    const statuses = [];
    for (let i = 0; i < 5; i += 1) statuses.push((await request(mini).get('/geo')).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
    expect(env.geo.rateLimitPerMinute).toBeGreaterThan(0);
  });
});
