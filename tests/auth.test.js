import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getLastOtpForTesting } from '../src/services/sms.provider.js';
import { env } from '../src/config/env.js';
import { Otp } from '../src/models/Otp.js';

const app = createApp();
const base = env.apiBasePath;
// Fresh mobile per test: the OTP send limiter (3 / 15 min / mobile) is real and in-memory,
// so reusing one number across tests would correctly start returning 429.
let MOBILE;
let mobileSeq = 0;
beforeEach(() => {
  mobileSeq += 1;
  MOBILE = `98765${String(10000 + mobileSeq)}`;
});

describe('Auth — OTP flow', () => {
  it('sends an OTP and verifies it, creating a new user on first login', async () => {
    const sendRes = await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.success).toBe(true);

    const code = getLastOtpForTesting(MOBILE);
    expect(code).toMatch(/^\d{6}$/);

    const verifyRes = await request(app)
      .post(`${base}/auth/otp/verify`)
      .send({ mobile: MOBILE, code, purpose: 'login', name: 'Ritesh' });

    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data.isNewUser).toBe(true);
    expect(verifyRes.body.data.user.mobile).toBe(MOBILE);
    expect(verifyRes.body.data.user.id).toBeDefined();
    expect(verifyRes.body.data.user._id).toBeUndefined();
    expect(verifyRes.body.data.accessToken).toBeDefined();
    expect(verifyRes.body.data.refreshToken).toBeDefined();
  });

  it('rejects an incorrect OTP with OTP_INVALID and increments attempts', async () => {
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });

    const res = await request(app)
      .post(`${base}/auth/otp/verify`)
      .send({ mobile: MOBILE, code: '000000', purpose: 'login' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('rejects verification after max attempts with OTP_MAX_ATTEMPTS', async () => {
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });

    for (let i = 0; i < env.otp.maxAttempts; i += 1) {
      await request(app).post(`${base}/auth/otp/verify`).send({ mobile: MOBILE, code: '000000', purpose: 'login' });
    }

    const res = await request(app)
      .post(`${base}/auth/otp/verify`)
      .send({ mobile: MOBILE, code: '000000', purpose: 'login' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_MAX_ATTEMPTS');
  });

  it('rejects an expired OTP with OTP_EXPIRED', async () => {
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });
    const code = getLastOtpForTesting(MOBILE);

    await Otp.updateMany({ mobile: MOBILE }, { expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: MOBILE, code, purpose: 'login' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_EXPIRED');
  });

  it('rejects malformed mobile numbers at the validation layer', async () => {
    const res = await request(app).post(`${base}/auth/otp/send`).send({ mobile: '12345', purpose: 'login' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in an existing verified user without creating a duplicate', async () => {
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });
    let code = getLastOtpForTesting(MOBILE);
    await request(app).post(`${base}/auth/otp/verify`).send({ mobile: MOBILE, code, purpose: 'login' });

    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });
    code = getLastOtpForTesting(MOBILE);
    const res = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: MOBILE, code, purpose: 'login' });

    expect(res.status).toBe(200);
    expect(res.body.data.isNewUser).toBe(false);
  });

  it('rejects protected routes without a bearer token', async () => {
    const res = await request(app).get(`${base}/me`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('refresh right after login (same second) rotates cleanly instead of colliding on tokenHash', async () => {
    await request(app).post(`${base}/auth/otp/send`).send({ mobile: MOBILE, purpose: 'login' });
    const code = getLastOtpForTesting(MOBILE);
    const login = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: MOBILE, code, purpose: 'login' });

    const refreshed = await request(app).post(`${base}/auth/refresh`).send({ refreshToken: login.body.data.refreshToken });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.refreshToken).not.toBe(login.body.data.refreshToken);

    const reused = await request(app).post(`${base}/auth/refresh`).send({ refreshToken: login.body.data.refreshToken });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('REFRESH_TOKEN_REUSED');
  });
});
