import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Otp } from '../src/models/Otp.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { getLastOtpForTesting } from '../src/services/sms.provider.js';
import { hashPassword, recoverStaffAccount, setPassword } from '../src/services/staff-auth.service.js';
import { createStaffLoginLimiters } from '../src/middleware/rateLimit.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { assertSeedAdminConfig } from '../src/seed/admin-config.js';
import { createAuthedUser, bearer } from './helpers.js';

const app = createApp();
const base = env.apiBasePath;
const PASSWORD = 'Sup3rSecret';

let seq = 0;
/** A staff user that can sign in with username + password. Each test gets its own username (the per-username limiter is real). */
async function staff({ role = 'admin', password = PASSWORD, isActive = true, name } = {}) {
  seq += 1;
  const username = `${role}.user${seq}`;
  const user = await User.create({
    mobile: `9${String(700000000 + seq).padStart(9, '0')}`,
    name: name || `Test ${role} ${seq}`,
    role,
    username,
    passwordHash: await hashPassword(password),
    passwordChangedAt: new Date(Date.now() - 300_000),
    isVerified: true,
    isActive,
  });
  return { user, username, password };
}

const login = (body) => request(app).post(`${base}/auth/staff/login`).send(body);

describe('Staff login (admin / rider): username + password', () => {
  describe('POST /auth/staff/login', () => {
    it('signs an admin in with the same response shape as the OTP verify, without any private field', async () => {
      const { user, username } = await staff();
      const res = await login({ username, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'isNewUser', 'refreshToken', 'user']);
      expect(res.body.data.isNewUser).toBe(false);
      expect(res.body.data.user).toMatchObject({ id: user.id, role: 'admin', username, mobile: user.mobile });
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|failedLoginAttempts|lockUntil|\$2[aby]\$/);

      const stats = await request(app).get(`${base}/admin/stats`).set({ Authorization: `Bearer ${res.body.data.accessToken}` });
      expect(stats.status).toBe(200);
    });

    it('signs a rider in; the token works on /rider/* and not on /admin/*', async () => {
      const { username } = await staff({ role: 'rider' });
      const res = await login({ username, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('rider');
      const h = { Authorization: `Bearer ${res.body.data.accessToken}` };
      expect((await request(app).get(`${base}/rider/orders`).set(h)).status).toBe(200);
      expect((await request(app).get(`${base}/admin/stats`).set(h)).status).toBe(403);
    });

    it('ignores case and surrounding spaces in the username; the password is case-sensitive', async () => {
      const { username } = await staff();
      expect((await login({ username: `  ${username.toUpperCase()} `, password: PASSWORD })).status).toBe(200);
      expect((await login({ username, password: PASSWORD.toLowerCase() })).status).toBe(401);
    });

    it('the refresh token it returns works with /auth/refresh and /auth/logout', async () => {
      const { username } = await staff();
      const { refreshToken } = (await login({ username, password: PASSWORD })).body.data;
      const refreshed = await request(app).post(`${base}/auth/refresh`).send({ refreshToken });
      expect(refreshed.status).toBe(200);
      expect((await request(app).post(`${base}/auth/logout`).send({ refreshToken: refreshed.body.data.refreshToken })).status).toBe(200);
    });

    it('a wrong password, an unknown username and a customer all get the SAME 401 INVALID_CREDENTIALS', async () => {
      const { username } = await staff();
      const customer = await createAuthedUser({ mobile: '9876500111' });
      await User.updateOne({ _id: customer.user._id }, { username: 'a.customer', passwordHash: await hashPassword(PASSWORD) });

      const wrong = await login({ username, password: 'Wrong-pass1' });
      const unknown = await login({ username: 'nobody.here', password: 'Wrong-pass1' });
      const asCustomer = await login({ username: 'a.customer', password: PASSWORD }); // even with the RIGHT password
      for (const res of [wrong, unknown, asCustomer]) {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      }
      expect(unknown.body).toEqual(wrong.body);
      expect(asCustomer.body).toEqual(wrong.body);
    });

    it('a staff user without a password (older account) cannot sign in', async () => {
      const user = await User.create({ mobile: '9876500222', name: 'Old Admin', role: 'admin', username: 'old.admin', isVerified: true });
      expect((await login({ username: user.username, password: PASSWORD })).body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('an inactive account is 403 ACCOUNT_DISABLED, but only after the password was right', async () => {
      const { username } = await staff({ role: 'rider', isActive: false });
      const ok = await login({ username, password: PASSWORD });
      expect([ok.status, ok.body.error.code]).toEqual([403, 'ACCOUNT_DISABLED']);
      expect((await login({ username, password: 'Wrong-pass1' })).body.error.code).toBe('INVALID_CREDENTIALS'); // no hint without the password
    });

    it('validates the body (strict, required fields)', async () => {
      for (const body of [{}, { username: 'x' }, { password: 'x' }, { username: 'a', password: 'b', extra: 1 }, { username: '', password: 'b' }, { username: 5, password: 'b' }]) {
        const res = await login(body);
        expect([JSON.stringify(body), res.status, res.body.error.code]).toEqual([JSON.stringify(body), 400, 'VALIDATION_ERROR']);
      }
    });
  });

  // ------------------------------------------------------------------ lock
  describe('account lock', () => {
    it('5 wrong passwords lock the account for 15 minutes: 429 ACCOUNT_LOCKED with retryAfterSeconds, even for the right password', async () => {
      const { user, username } = await staff();
      for (let i = 1; i <= 4; i += 1) {
        expect((await login({ username, password: `Wrong-pass${i}` })).status).toBe(401);
      }
      const fifth = await login({ username, password: 'Wrong-pass5' });
      expect([fifth.status, fifth.body.error.code]).toEqual([429, 'ACCOUNT_LOCKED']);
      expect(fifth.body.error.details.retryAfterSeconds).toBeGreaterThan(14 * 60);
      expect(fifth.body.error.details.retryAfterSeconds).toBeLessThanOrEqual(15 * 60);

      const right = await login({ username, password: PASSWORD });
      expect([right.status, right.body.error.code]).toEqual([429, 'ACCOUNT_LOCKED']);
      expect(right.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

      const stored = await User.findById(user.id);
      expect(stored.lockUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    });

    it('the lock lifts by itself; the counter starts again from zero', async () => {
      const { user, username } = await staff();
      for (let i = 0; i < 5; i += 1) await login({ username, password: 'Wrong-pass1' });
      await User.updateOne({ _id: user._id }, { lockUntil: new Date(Date.now() - 1000) }); // 15 minutes later
      expect((await login({ username, password: PASSWORD })).status).toBe(200);
      const stored = await User.findById(user.id);
      expect([stored.failedLoginAttempts, stored.lockUntil ?? null]).toEqual([0, null]);
    });

    it('a successful login resets the counter (3 wrong, 1 right, then 4 wrong is still no lock)', async () => {
      const { username } = await staff();
      for (let i = 0; i < 3; i += 1) await login({ username, password: 'Wrong-pass1' });
      expect((await login({ username, password: PASSWORD })).status).toBe(200);
      for (let i = 0; i < 4; i += 1) expect((await login({ username, password: 'Wrong-pass1' })).status).toBe(401);
      expect((await login({ username, password: PASSWORD })).status).toBe(200);
    });

    it('is atomic: parallel guesses never get more than 5 tries in total', async () => {
      const { user, username } = await staff();
      const results = await Promise.all(Array.from({ length: 8 }, (_, i) => login({ username, password: `Wrong-guess${i}` })));
      const codes = results.map((r) => r.body.error.code);
      expect(codes.filter((c) => c === 'INVALID_CREDENTIALS').length).toBeLessThanOrEqual(4); // slot 5 is the one that locks
      expect(codes.filter((c) => c === 'ACCOUNT_LOCKED').length).toBeGreaterThanOrEqual(4);
      expect(new Set(codes)).toEqual(new Set(['INVALID_CREDENTIALS', 'ACCOUNT_LOCKED'].filter((c) => codes.includes(c))));
      expect((await User.findById(user.id)).lockUntil.getTime()).toBeGreaterThan(Date.now());
    });

    it('locking is per account: other staff are not affected', async () => {
      const a = await staff();
      const b = await staff();
      for (let i = 0; i < 5; i += 1) await login({ username: a.username, password: 'Wrong-pass1' });
      expect((await login({ username: b.username, password: PASSWORD })).status).toBe(200);
    });
  });

  // ------------------------------------------------------------------ rate limiters
  describe('rate limiting', () => {
    it('per username: after 10 failed attempts in the window further ones are 429 RATE_LIMITED (successful logins never count)', async () => {
      const { username } = await staff();
      // the account would lock after 5, so use a fresh account for every 4 attempts... instead hit an unknown username
      for (let i = 0; i < env.staff.loginUserLimit; i += 1) expect((await login({ username: 'ghost.user', password: 'x' })).status).toBe(401);
      const limited = await login({ username: 'ghost.user', password: 'x' });
      expect([limited.status, limited.body.error.code]).toEqual([429, 'RATE_LIMITED']);
      // another username is a different bucket
      expect((await login({ username, password: PASSWORD })).status).toBe(200);
    });

    it('the limiter factory: per-IP bucket counts only failures, per-username bucket is keyed by the (normalised) username', async () => {
      const limiters = createStaffLoginLimiters({ ipLimit: 3, userLimit: 2, windowMs: 60_000 });
      const mini = express();
      mini.use(express.json());
      mini.post('/login', limiters.ip, limiters.user, (req, res) => (req.body.password === 'ok' ? res.json({ ok: true }) : res.status(401).json({ ok: false })));
      mini.use(errorHandler);

      const post = (username, password) => request(mini).post('/login').send({ username, password });
      for (let i = 0; i < 5; i += 1) expect((await post('someone', 'ok')).status).toBe(200); // successes are free
      expect((await post('Alice', 'no')).status).toBe(401);
      expect((await post(' alice ', 'no')).status).toBe(401);
      expect((await post('alice', 'no')).status).toBe(429); // 3rd failure for "alice" (user limit 2)... also the IP's 3rd
      expect((await post('bob', 'no')).status).toBe(429); // IP bucket (3 failures) is used up for everyone
    });
  });

  // ------------------------------------------------------------------ OTP no longer for staff
  describe('OTP login is for customers only', () => {
    it('/auth/otp/send answers 403 USE_PASSWORD_LOGIN for an admin or rider mobile and sends / stores nothing', async () => {
      const admin = await staff({ role: 'admin' });
      const rider = await staff({ role: 'rider' });
      for (const who of [admin, rider]) {
        const res = await request(app).post(`${base}/auth/otp/send`).send({ mobile: who.user.mobile, purpose: 'login' });
        expect([res.status, res.body.error.code]).toEqual([403, 'USE_PASSWORD_LOGIN']);
        expect(getLastOtpForTesting(who.user.mobile)).toBeUndefined(); // the SMS stub was never called
        expect(await Otp.countDocuments({ mobile: who.user.mobile })).toBe(0);
      }
    });

    it('/auth/otp/verify refuses staff too (even with an OTP that exists)', async () => {
      const admin = await staff({ role: 'admin' });
      const res = await request(app).post(`${base}/auth/otp/verify`).send({ mobile: admin.user.mobile, code: '123456', purpose: 'login' });
      expect([res.status, res.body.error.code]).toEqual([403, 'USE_PASSWORD_LOGIN']);
    });

    it('customers are unaffected (new or existing)', async () => {
      const mobile = '9811100001';
      const sent = await request(app).post(`${base}/auth/otp/send`).send({ mobile, purpose: 'login' });
      expect(sent.status).toBe(200);
      const verified = await request(app).post(`${base}/auth/otp/verify`).send({ mobile, code: getLastOtpForTesting(mobile), purpose: 'login', name: 'Cust' });
      expect(verified.status).toBe(201);
    });

    it('the OTP `code` is only echoed for NODE_ENV != production AND SMS_PROVIDER=console', async () => {
      const saved = { isProd: env.isProd, sms: env.otp.smsProvider };
      const send = async (mobile) => (await request(app).post(`${base}/auth/otp/send`).send({ mobile, purpose: 'login' })).body.data;
      try {
        expect(await send('9822200001')).toEqual(expect.objectContaining({ code: expect.stringMatching(/^\d{6}$/) }));

        env.isProd = true;
        const prod = await send('9822200002');
        expect(prod).not.toHaveProperty('code');
        expect(JSON.stringify(prod)).not.toContain(getLastOtpForTesting('9822200002')); // the real code is nowhere in the response
        expect(Object.keys(prod).sort()).toEqual(['expiresAt', 'mobile', 'ttlMinutes']);

        env.isProd = false;
        env.otp.smsProvider = 'twilio';
        expect(await send('9822200003')).not.toHaveProperty('code');
      } finally {
        env.isProd = saved.isProd;
        env.otp.smsProvider = saved.sms;
      }
    });
  });

  // ------------------------------------------------------------------ change password
  describe('PATCH /me/password', () => {
    const change = (token, body) => request(app).patch(`${base}/me/password`).set({ Authorization: `Bearer ${token}` }).send(body);
    const NEW = 'N3wPassw0rd';

    it('changes the password, ends the other sessions and hands this session a fresh token pair', async () => {
      const { user, username } = await staff();
      const here = (await login({ username, password: PASSWORD })).body.data;
      const elsewhere = (await login({ username, password: PASSWORD })).body.data;
      // an access token issued before the change (backdated so it is clearly older than it)
      const stale = jwt.sign({ sub: user.id, role: 'admin', iat: Math.floor(Date.now() / 1000) - 120 }, env.jwt.accessSecret, { expiresIn: '15m' });
      expect((await request(app).get(`${base}/me`).set({ Authorization: `Bearer ${stale}` })).status).toBe(200);

      const res = await change(here.accessToken, { currentPassword: PASSWORD, newPassword: NEW });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual(['accessToken', 'passwordChangedAt', 'refreshToken']);

      // this session continues with the new pair
      expect((await request(app).get(`${base}/me`).set({ Authorization: `Bearer ${res.body.data.accessToken}` })).status).toBe(200);
      expect((await request(app).post(`${base}/auth/refresh`).send({ refreshToken: res.body.data.refreshToken })).status).toBe(200);
      // every other refresh token is revoked, and older access tokens stop working
      for (const old of [here.refreshToken, elsewhere.refreshToken]) {
        expect((await request(app).post(`${base}/auth/refresh`).send({ refreshToken: old })).body.error.code).toMatch(/REFRESH_TOKEN_(REUSED|INVALID)/);
      }
      const staleAfter = await request(app).get(`${base}/me`).set({ Authorization: `Bearer ${stale}` });
      expect([staleAfter.status, staleAfter.body.error.code]).toEqual([401, 'TOKEN_INVALID']);

      // new password signs in, old one does not
      expect((await login({ username, password: NEW })).status).toBe(200);
      expect((await login({ username, password: PASSWORD })).status).toBe(401);
      expect(await RefreshToken.countDocuments({ user: user._id, revokedAt: null })).toBeGreaterThan(0);
    });

    it('works for a rider too', async () => {
      const { username } = await staff({ role: 'rider' });
      const { accessToken } = (await login({ username, password: PASSWORD })).body.data;
      expect((await change(accessToken, { currentPassword: PASSWORD, newPassword: NEW })).status).toBe(200);
    });

    it('rejects weak passwords: min 8, a letter and a number, max 72 bytes; and the same password again', async () => {
      const { username } = await staff();
      const { accessToken } = (await login({ username, password: PASSWORD })).body.data;
      for (const [label, newPassword] of [['short', 'Ab1'], ['no digit', 'abcdefghij'], ['no letter', '1234567890'], ['too long', `${'a1'.repeat(40)}`], ['same', PASSWORD]]) {
        const res = await change(accessToken, { currentPassword: PASSWORD, newPassword });
        expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
      }
      expect((await change(accessToken, { currentPassword: PASSWORD, newPassword: 'Abcdefg1' })).status).toBe(200); // exactly 8
    });

    it('a wrong current password is 400 INVALID_CURRENT_PASSWORD, counts towards the lock, and changes nothing', async () => {
      const { username } = await staff();
      const { accessToken } = (await login({ username, password: PASSWORD })).body.data;
      for (let i = 0; i < 4; i += 1) {
        const res = await change(accessToken, { currentPassword: 'Wrong-pass1', newPassword: NEW });
        expect([res.status, res.body.error.code]).toEqual([400, 'INVALID_CURRENT_PASSWORD']);
      }
      const locked = await change(accessToken, { currentPassword: 'Wrong-pass1', newPassword: NEW });
      expect([locked.status, locked.body.error.code]).toEqual([429, 'ACCOUNT_LOCKED']);
      expect((await login({ username, password: NEW })).status).toBe(429);
    });

    it('is for staff only, needs a token and a strict body', async () => {
      const customer = await createAuthedUser();
      expect((await change(customer.accessToken, { currentPassword: 'x', newPassword: NEW })).status).toBe(403);
      expect((await request(app).patch(`${base}/me/password`).send({ currentPassword: 'x', newPassword: NEW })).status).toBe(401);
      const { username } = await staff();
      const { accessToken } = (await login({ username, password: PASSWORD })).body.data;
      expect((await change(accessToken, { currentPassword: PASSWORD, newPassword: NEW, extra: 1 })).status).toBe(400);
      expect((await change(accessToken, { newPassword: NEW })).status).toBe(400);
    });
  });
});

// ================================================================== riders managed by an admin
describe('Admin manages rider credentials', () => {
  let admin;
  let adminH;
  beforeEach(async () => {
    admin = await createAuthedUser({ role: 'admin' });
    adminH = bearer(admin);
  });

  let n = 0;
  const body = (over = {}) => {
    n += 1;
    return { name: 'Ramesh Kumar', mobile: `9877${String(710000 + n).padStart(6, '0')}`, username: `ramesh.${n}`, password: 'Rid3rPass', ...over };
  };
  const create = (b, h = adminH) => request(app).post(`${base}/admin/riders`).set(h).send(b);

  it('POST /admin/riders needs mobile, username and password; the rider can then sign in; no hash is ever returned', async () => {
    const b = body();
    const res = await create(b);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({
      id: expect.any(String),
      name: 'Ramesh Kumar',
      mobile: b.mobile,
      username: b.username,
      isActive: true,
      activeOrders: 0,
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Rid3rPass|\$2[aby]\$/);

    expect((await login({ username: b.username, password: b.password })).body.data.user.role).toBe('rider');
    const stored = await User.findById(res.body.data.id).select('+passwordHash');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(stored.passwordHash).not.toContain('Rid3rPass');

    for (const missing of ['username', 'password', 'mobile', 'name']) {
      const partial = body();
      delete partial[missing];
      expect([missing, (await create(partial)).status]).toEqual([missing, 400]);
    }
  });

  it('validates username and password; 409 USERNAME_TAKEN (also against an admin or customer) and 409 MOBILE_ALREADY_REGISTERED', async () => {
    for (const [label, over] of [
      ['short username', { username: 'ab' }],
      ['bad characters', { username: 'Rid er' }],
      ['dash', { username: 'rid-er' }],
      ['31 chars', { username: 'a'.repeat(31) }],
      ['weak password', { password: 'password' }],
      ['short password', { password: 'Ab1' }],
    ]) {
      const res = await create(body(over));
      expect([label, res.status, res.body.error.code]).toEqual([label, 400, 'VALIDATION_ERROR']);
    }
    expect((await create(body({ username: '  Mixed.Case_1 ' }))).body.data.username).toBe('mixed.case_1'); // normalised
    expect((await create(body({ username: 'MIXED.case_1' }))).body.error.code).toBe('USERNAME_TAKEN');

    const other = await staff({ role: 'admin' });
    const clash = await create(body({ username: other.username }));
    expect([clash.status, clash.body.error.code]).toEqual([409, 'USERNAME_TAKEN']);

    const b = body();
    await create(b);
    expect((await create(body({ mobile: b.mobile }))).body.error.code).toBe('MOBILE_ALREADY_REGISTERED');
  });

  it('GET /admin/riders shows the username (null for an older rider without one), searchable, never a hash', async () => {
    const b = body({ username: 'findme.rider' });
    await create(b);
    const legacy = await User.create({ mobile: '9877799999', name: 'Old Rider', role: 'rider', isVerified: true });
    const res = await request(app).get(`${base}/admin/riders`).set(adminH);
    const byId = Object.fromEntries(res.body.data.map((r) => [r.id, r]));
    expect(byId[legacy.id].username).toBeNull();
    expect(Object.values(byId).map((r) => r.username).sort((a, b) => String(a).localeCompare(String(b)))).toEqual(['findme.rider', null]);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    expect((await request(app).get(`${base}/admin/riders?q=findme`).set(adminH)).body.data.map((r) => r.username)).toEqual(['findme.rider']);
  });

  it('PATCH can change the username and RESET the password: the rider\'s sessions end and the new password works', async () => {
    const b = body();
    const rider = (await create(b)).body.data;
    const session = (await login({ username: b.username, password: b.password })).body.data;
    const stale = jwt.sign({ sub: rider.id, role: 'rider', iat: Math.floor(Date.now() / 1000) - 120 }, env.jwt.accessSecret, { expiresIn: '15m' });

    const res = await request(app).patch(`${base}/admin/riders/${rider.id}`).set(adminH).send({ username: 'renamed.rider', password: 'Reset-Pass9' });
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('renamed.rider');
    expect(JSON.stringify(res.body)).not.toMatch(/Reset-Pass9|passwordHash/);

    expect((await request(app).post(`${base}/auth/refresh`).send({ refreshToken: session.refreshToken })).status).toBe(401);
    expect((await request(app).get(`${base}/rider/orders`).set({ Authorization: `Bearer ${stale}` })).status).toBe(401);
    expect((await login({ username: b.username, password: b.password })).status).toBe(401);
    expect((await login({ username: 'renamed.rider', password: 'Reset-Pass9' })).status).toBe(200);
  });

  it('a reset also clears a lock; a username-only change keeps the password and the sessions', async () => {
    const b = body();
    const rider = (await create(b)).body.data;
    const session = (await login({ username: b.username, password: b.password })).body.data;
    expect((await request(app).patch(`${base}/admin/riders/${rider.id}`).set(adminH).send({ username: 'just.renamed' })).status).toBe(200);
    expect((await request(app).post(`${base}/auth/refresh`).send({ refreshToken: session.refreshToken })).status).toBe(200);
    expect((await login({ username: 'just.renamed', password: b.password })).status).toBe(200);

    for (let i = 0; i < 5; i += 1) await login({ username: 'just.renamed', password: 'Wrong-pass1' });
    expect((await login({ username: 'just.renamed', password: b.password })).status).toBe(429);
    await request(app).patch(`${base}/admin/riders/${rider.id}`).set(adminH).send({ password: 'Fresh-Pass1' });
    expect((await login({ username: 'just.renamed', password: 'Fresh-Pass1' })).status).toBe(200);
  });

  it('PATCH: 409 USERNAME_TAKEN, weak passwords refused, an older rider needs a username together with a password', async () => {
    const a = (await create(body())).body.data;
    const b = (await create(body())).body.data;
    expect((await request(app).patch(`${base}/admin/riders/${b.id}`).set(adminH).send({ username: a.username })).body.error.code).toBe('USERNAME_TAKEN');
    expect((await request(app).patch(`${base}/admin/riders/${b.id}`).set(adminH).send({ username: b.username })).status).toBe(200); // own username is fine
    expect((await request(app).patch(`${base}/admin/riders/${b.id}`).set(adminH).send({ password: 'weak' })).status).toBe(400);

    const legacy = await User.create({ mobile: '9877788888', name: 'Old Rider', role: 'rider', isVerified: true });
    const noName = await request(app).patch(`${base}/admin/riders/${legacy.id}`).set(adminH).send({ password: 'Passw0rd-ok' });
    expect([noName.status, noName.body.error.code]).toEqual([400, 'VALIDATION_ERROR']);
    const both = await request(app).patch(`${base}/admin/riders/${legacy.id}`).set(adminH).send({ username: 'old.rider', password: 'Passw0rd-ok' });
    expect([both.status, both.body.data.username]).toEqual([200, 'old.rider']);
    expect((await login({ username: 'old.rider', password: 'Passw0rd-ok' })).status).toBe(200);
  });
});

// ================================================================== seed + recovery
describe('Seed and recovery', () => {
  it('assertSeedAdminConfig: no default password — production without SEED_ADMIN_PASSWORD fails; weak ones fail; dev may skip it', () => {
    const saved = { isProd: env.isProd, password: env.seed.adminPassword };
    try {
      env.isProd = true;
      env.seed.adminPassword = '';
      expect(() => assertSeedAdminConfig()).toThrow(/SEED_ADMIN_PASSWORD is required/);
      env.seed.adminPassword = 'short1';
      expect(() => assertSeedAdminConfig()).toThrow(/not acceptable/);
      env.seed.adminPassword = 'Str0ngEnough';
      expect(() => assertSeedAdminConfig()).not.toThrow();

      env.isProd = false;
      env.seed.adminPassword = '';
      expect(() => assertSeedAdminConfig()).not.toThrow();
      env.seed.adminPassword = 'allletters';
      expect(() => assertSeedAdminConfig()).toThrow(/not acceptable/);
    } finally {
      env.isProd = saved.isProd;
      env.seed.adminPassword = saved.password;
    }
  });

  it('recoverStaffAccount sets a password by username, clears a lock and ends every session', async () => {
    const { user, username } = await staff();
    const session = (await login({ username, password: PASSWORD })).body.data;
    for (let i = 0; i < 5; i += 1) await login({ username, password: 'Wrong-pass1' });
    expect((await login({ username, password: PASSWORD })).status).toBe(429);

    const result = await recoverStaffAccount({ username: username.toUpperCase(), password: 'Recovered-1' });
    expect(result).toMatchObject({ username, role: 'admin' });
    expect((await request(app).post(`${base}/auth/refresh`).send({ refreshToken: session.refreshToken })).status).toBe(401);
    expect((await login({ username, password: 'Recovered-1' })).status).toBe(200);
    expect((await User.findById(user.id)).failedLoginAttempts).toBe(0);
  });

  it('an older admin without a username is found by --mobile and given the username; helpful errors otherwise', async () => {
    const legacy = await User.create({ mobile: '9999900001', name: 'Legacy Admin', role: 'admin', isVerified: true });

    await expect(recoverStaffAccount({ username: 'legacy.admin', password: 'Recovered-1' })).rejects.toThrow(/Legacy Admin \(admin, 9999900001\).*--mobile/);
    await expect(recoverStaffAccount({ username: 'legacy.admin', password: 'Recovered-1', mobile: '9000000000' })).rejects.toThrow(/No admin or rider has the mobile/);
    await expect(recoverStaffAccount({ username: 'legacy.admin', password: 'weak' })).rejects.toThrow(/at least 8/);
    await expect(recoverStaffAccount({ username: 'a', password: 'Recovered-1' })).rejects.toThrow(/Username must be/);

    await recoverStaffAccount({ username: 'legacy.admin', password: 'Recovered-1', mobile: legacy.mobile });
    expect((await login({ username: 'legacy.admin', password: 'Recovered-1' })).body.data.user.id).toBe(legacy.id);
    await expect(recoverStaffAccount({ username: 'other.name', password: 'Recovered-1', mobile: legacy.mobile })).rejects.toThrow(/already has the username/);
  });

  it('refuses customers (by username or mobile)', async () => {
    const customer = await createAuthedUser({ mobile: '9876500333' });
    await User.updateOne({ _id: customer.user._id }, { username: 'plain.customer' });
    await expect(recoverStaffAccount({ username: 'plain.customer', password: 'Recovered-1' })).rejects.toThrow(/not to an admin or rider/);
    await expect(recoverStaffAccount({ username: 'new.name', password: 'Recovered-1', mobile: '9876500333' })).rejects.toThrow(/No admin or rider has the mobile/);
  });

  it('setPassword never stores the plain password', async () => {
    const user = await User.create({ mobile: '9999900002', name: 'Someone', role: 'admin', username: 'someone.admin', isVerified: true });
    await setPassword(user, 'Plain-Text1');
    const stored = await User.findById(user.id).select('+passwordHash');
    expect(stored.passwordHash).not.toContain('Plain-Text1');
    expect(stored.passwordChangedAt).toBeInstanceOf(Date);
  });
});
