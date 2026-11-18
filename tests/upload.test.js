import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach } from '@jest/globals';
import https from 'https';
import crypto from 'crypto';
import request from 'supertest';
import { v2 as cloudinary } from 'cloudinary';
import selfsigned from 'selfsigned';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { storageWarnings } from '../src/services/storage.service.js';
import { createAuthedUser } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const URL_PATH = `${base}/admin/uploads`;

// A tiny valid PNG, plus a marker so each "file" has distinct, recognisable bytes.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const png = (marker) => Buffer.concat([PNG, Buffer.from(marker)]);
const markerOf = (buf) => buf.subarray(PNG.length).toString();

/**
 * Stand-in for api.cloudinary.com. The REAL cloudinary SDK is pointed at it via `upload_prefix`, so what we
 * assert is the exact request the SDK builds (path, signed params, transformation, file bytes).
 */
async function startFakeCloudinary() {
  const state = { uploads: [], destroys: [], mode: () => 'ok', delay: () => 0 };
  // The SDK only speaks https, so the stand-in needs a (throwaway, in-memory) self-signed certificate.
  const pems = await selfsigned.generate([{ name: 'commonName', value: '127.0.0.1' }], { days: 2 });
  const server = https.createServer({ key: pems.private, cert: pems.cert }, (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', async () => {
      const body = Buffer.concat(chunks);
      const boundary = `--${/boundary=(.+)$/.exec(req.headers['content-type'])[1]}`;
      const fields = {};
      let file = null;
      for (const part of body.toString('latin1').split(boundary).slice(1, -1)) {
        const [head, ...rest] = part.split('\r\n\r\n');
        const value = rest.join('\r\n\r\n').replace(/\r\n$/, '');
        const name = /name="([^"]+)"/.exec(head)[1];
        if (/filename=/.test(head)) file = Buffer.from(value, 'latin1');
        else fields[name] = value;
      }

      const send = (status, json) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
      };

      if (req.url.endsWith('/image/destroy')) {
        state.destroys.push({ url: req.url, fields });
        return send(200, { result: 'ok' });
      }

      const marker = markerOf(file);
      state.uploads.push({ url: req.url, headers: req.headers, fields, file, marker });
      await new Promise((r) => setTimeout(r, state.delay(marker)));

      const mode = state.mode(marker);
      if (mode === 'bad-image') return send(400, { error: { message: 'Invalid image file' } });
      if (mode === 'server-error') return send(500, { error: { message: 'SECRET internal detail' } });
      return send(200, {
        public_id: `aali-market/products/${marker}`,
        version: 1700000000,
        type: 'upload',
        resource_type: 'image',
        format: 'jpg',
        secure_url: `https://res.cloudinary.com/demo-cloud/image/upload/v1700000000/aali-market/products/${marker}.jpg`,
      });
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port })));
}

describe('POST /admin/uploads — Cloudinary', () => {
  let fake;
  let adminH;
  const saved = { cloudinaryEnv: { ...env.cloudinary }, storage: { ...env.storage } };
  const SECRET = 'test_api_secret';

  beforeAll(async () => {
    fake = await startFakeCloudinary();
  });
  afterAll(async () => {
    cloudinary.config({ upload_prefix: undefined, api_proxy: undefined });
    await new Promise((r) => fake.server.close(r));
  });

  beforeEach(async () => {
    Object.assign(env.cloudinary, { cloudName: 'demo-cloud', apiKey: '123456789012345', apiSecret: SECRET });
    env.storage.provider = 'cloudinary';
    // Point the real SDK at the stand-in (never the real API) and let it accept the self-signed cert.
    cloudinary.config({ upload_prefix: `https://127.0.0.1:${fake.port}`, api_proxy: { rejectUnauthorized: false } });
    fake.state.uploads.length = 0;
    fake.state.destroys.length = 0;
    fake.state.mode = () => 'ok';
    fake.state.delay = () => 0;
    adminH = { Authorization: `Bearer ${(await createAuthedUser({ role: 'admin' })).accessToken}` };
  });

  afterEach(() => {
    Object.assign(env.cloudinary, saved.cloudinaryEnv);
    Object.assign(env.storage, saved.storage);
  });

  const post = (files, headers = adminH) => {
    const r = request(app).post(URL_PATH).set(headers);
    files.forEach(([buf, name = 'photo.png', type = 'image/png', field = 'images']) =>
      r.attach(field, buf, { filename: name, contentType: type })
    );
    return r;
  };

  it('keeps the contract: 201 { success, data: { urls: [https res.cloudinary.com URL] }, error: null }', async () => {
    const res = await post([[png('AAAA')]]);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      data: { urls: ['https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto/v1700000000/aali-market/products/AAAA'] },
      error: null,
    });
    expect(res.body.data.urls[0]).toMatch(/^https:\/\/res\.cloudinary\.com\//);
  });

  it('sends the real SDK request: signed, folder, resource_type image, size-limit + q_auto — and NO f_auto — on the raw bytes', async () => {
    const original = png('BBBB');
    await post([[original]]);

    expect(fake.state.uploads).toHaveLength(1);
    const { url, fields, file } = fake.state.uploads[0];
    expect(url).toBe('/v1_1/demo-cloud/image/upload'); // image upload endpoint
    expect(fields.folder).toBe('aali-market/products');
    expect(fields.transformation).toBe('c_limit,h_1000,w_1000/q_auto');
    expect(fields.transformation).not.toMatch(/f_auto/); // Cloudinary: never f_auto in an incoming transformation
    expect(fields.api_key).toBe('123456789012345');
    expect(file.equals(original)).toBe(true); // the in-memory buffer arrived byte-for-byte (no temp-file round trip)

    // The SDK signs sorted `k=v` pairs of the signed params + the API secret with SHA-1; ours must verify.
    const signed = Object.entries(fields)
      .filter(([k]) => !['file', 'api_key', 'signature', 'resource_type', 'cloud_name'].includes(k))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('&');
    expect(fields.signature).toBe(crypto.createHash('sha1').update(signed + SECRET).digest('hex'));
  });

  it('uploads up to 6 files in parallel and returns the urls in the same order as the files, even if responses finish out of order', async () => {
    fake.state.delay = (m) => (m === 'F1F1' ? 200 : 0); // the FIRST file answers last
    const markers = ['F1F1', 'F2F2', 'F3F3', 'F4F4', 'F5F5', 'F6F6'];
    const res = await post(markers.map((m) => [png(m)]));
    expect(res.status).toBe(201);
    expect(res.body.data.urls).toHaveLength(6);
    res.body.data.urls.forEach((u, i) => expect(u.endsWith(`/aali-market/products/${markers[i]}`)).toBe(true));
  });

  it('accepts a file of exactly 5 MB (the limit is inclusive) and each allowed type (jpeg/png/webp/avif)', async () => {
    const exactly5mb = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 - PNG.length - 4), Buffer.from('ZZZZ')]);
    expect(exactly5mb.length).toBe(5 * 1024 * 1024);
    expect((await post([[exactly5mb]])).status).toBe(201);

    for (const [i, type] of ['image/jpeg', 'image/webp', 'image/avif'].entries()) {
      expect((await post([[png(`T00${i}`), `p.${type.split('/')[1]}`, type]])).status).toBe(201);
    }
  });

  describe('validation (unchanged rules) — rejected before anything reaches Cloudinary', () => {
    const expectNoUpload = () => expect(fake.state.uploads).toHaveLength(0);

    it('rejects unsupported types', async () => {
      for (const [name, type] of [['x.gif', 'image/gif'], ['x.svg', 'image/svg+xml'], ['x.pdf', 'application/pdf'], ['x.txt', 'text/plain']]) {
        const res = await post([[Buffer.from('not an image'), name, type]]);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_ERROR');
      }
      expectNoUpload();
    });

    it('rejects a file over 5 MB with 413 FILE_TOO_LARGE (was a 500 before)', async () => {
      const res = await post([[Buffer.alloc(5 * 1024 * 1024 + 1), 'big.png']]);
      expect(res.status).toBe(413);
      expect(res.body).toEqual({ success: false, data: null, error: { code: 'FILE_TOO_LARGE', message: 'Each image must be 5 MB or smaller' } });
      expectNoUpload();
    });

    it('rejects more than 6 files, a wrong field name, and no file at all', async () => {
      const seven = await post(Array.from({ length: 7 }, (_, i) => [png(`S00${i}`)]));
      expect(seven.status).toBe(400);
      expect(seven.body.error.code).toBe('VALIDATION_ERROR');

      const wrongField = await post([[png('WWWW'), 'a.png', 'image/png', 'photos']]);
      expect(wrongField.status).toBe(400);

      const none = await request(app).post(URL_PATH).set(adminH);
      expect(none.status).toBe(400);
      expectNoUpload();
    });

    it('is admin-only', async () => {
      const customer = await createAuthedUser();
      expect((await post([[png('CCCC')]], { Authorization: `Bearer ${customer.accessToken}` })).status).toBe(403);
      expect((await post([[png('CCCC')]], {})).status).toBe(401);
      expectNoUpload();
    });
  });

  describe('Cloudinary failures -> UPLOAD_FAILED in the standard error envelope', () => {
    it('a file Cloudinary rejects as invalid -> 400 UPLOAD_FAILED', async () => {
      fake.state.mode = () => 'bad-image';
      const res = await post([[png('EEEE')]]);
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ success: false, data: null, error: { code: 'UPLOAD_FAILED', message: 'This file could not be processed as an image' } });
    });

    it('a Cloudinary outage -> 502 UPLOAD_FAILED, without leaking provider details', async () => {
      fake.state.mode = () => 'server-error';
      const res = await post([[png('EEEE')]]);
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPLOAD_FAILED');
      expect(JSON.stringify(res.body)).not.toMatch(/SECRET/);
    });

    it('is all-or-nothing: when one of three fails, the two that succeeded are deleted again (no orphans)', async () => {
      fake.state.mode = (m) => (m === 'BBBB' ? 'server-error' : 'ok');
      const res = await post([[png('AAAA')], [png('BBBB')], [png('CCCC')]]);
      expect(res.status).toBe(502);
      expect(res.body.error.code).toBe('UPLOAD_FAILED');

      const destroyed = fake.state.destroys.map((d) => d.fields.public_id).sort();
      expect(destroyed).toEqual(['aali-market/products/AAAA', 'aali-market/products/CCCC']);
      expect(fake.state.destroys.every((d) => d.url === '/v1_1/demo-cloud/image/destroy')).toBe(true);
    });
  });

  describe('missing / wrong configuration never crashes the server', () => {
    it('no Cloudinary credentials -> uploads answer 503 UPLOAD_FAILED and nothing is sent; startup only warns', async () => {
      Object.assign(env.cloudinary, { cloudName: '', apiKey: '', apiSecret: '' });
      const res = await post([[png('NNNN')]]);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('UPLOAD_FAILED');
      expect(fake.state.uploads).toHaveLength(0);

      expect(storageWarnings()).toHaveLength(1);
      expect(storageWarnings()[0]).toMatch(/CLOUDINARY_/);
      // ...and the rest of the API is unaffected
      expect((await request(app).get(`${base}/settings`)).status).toBe(200);
    });

    it('configured Cloudinary -> no warnings', () => {
      expect(storageWarnings()).toEqual([]);
    });

    it('STORAGE_PROVIDER=s3 with empty S3 credentials: no warning, nothing is loaded at boot', () => {
      env.storage.provider = 's3';
      expect(storageWarnings()).toEqual([]);
    });

    it('an unknown STORAGE_PROVIDER -> 503 UPLOAD_FAILED plus a warning', async () => {
      env.storage.provider = 'dropbox';
      expect(storageWarnings()[0]).toMatch(/not valid/);
      const res = await post([[png('PPPP')]]);
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('UPLOAD_FAILED');
    });
  });
});
