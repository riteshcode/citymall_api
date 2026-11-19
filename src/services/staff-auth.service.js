import bcrypt from 'bcrypt';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { issueTokenPair } from './auth.service.js';
import { passwordSchema, usernameSchema } from '../utils/zodHelpers.js';

/**
 * Username + password login for the two staff roles (admin, rider). Customers keep the OTP flow.
 *
 * Brute force protection is layered:
 *   - HTTP rate limiters per IP and per username (middleware/rateLimit.js)
 *   - an account lock (5 wrong passwords -> 15 minutes) driven by an ATOMIC counter: every attempt first reserves a
 *     slot with one conditional update, so N parallel guesses can never get more than 5 tries in total.
 */

export const STAFF_ROLES = ['admin', 'rider'];
export const isStaffRole = (role) => STAFF_ROLES.includes(role);

export const hashPassword = (password) => bcrypt.hash(password, env.bcryptCost);

// Compared against when the username does not exist, so "unknown user" and "wrong password" take the same time.
let dummyHash;
const getDummyHash = () => (dummyHash ??= bcrypt.hash('not-a-real-password-0', env.bcryptCost));

const invalidCredentials = () => ApiError.unauthorized(ErrorCodes.INVALID_CREDENTIALS, 'Incorrect username or password');

function lockedError(lockUntil) {
  const retryAfterSeconds = Math.max(1, Math.ceil((lockUntil.getTime() - Date.now()) / 1000));
  return new ApiError(429, ErrorCodes.ACCOUNT_LOCKED, 'Too many failed attempts. Try again later.', { retryAfterSeconds });
}

/** Reserves one password attempt atomically. Throws ACCOUNT_LOCKED when none are left. Returns the user (with passwordHash). */
async function reserveAttempt(userId) {
  const { maxFailedAttempts, lockMinutes } = env.staff;
  const reserved = await User.findOneAndUpdate(
    { _id: userId, lockUntil: { $not: { $gt: new Date() } }, failedLoginAttempts: { $lt: maxFailedAttempts } },
    { $inc: { failedLoginAttempts: 1 } },
    { new: true }
  ).select('+passwordHash');
  if (reserved) return reserved;

  const current = await User.findById(userId).select('lockUntil');
  // Either locked, or the 5th (failing) attempt is still in flight and has not written the lock yet.
  throw lockedError(current?.lockUntil > new Date() ? current.lockUntil : new Date(Date.now() + lockMinutes * 60 * 1000));
}

/**
 * Checks a password for a user, counting wrong ones towards the lock. Resolves true/false; throws ACCOUNT_LOCKED
 * when this attempt is not allowed, or when it was the wrong 5th one (the lock starts right then).
 */
async function checkPasswordWithLockout(userId, password) {
  const user = await reserveAttempt(userId);
  const ok = Boolean(user.passwordHash) && (await bcrypt.compare(password, user.passwordHash));

  if (ok) {
    await User.updateOne({ _id: userId }, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    return { ok: true, user };
  }
  if (user.failedLoginAttempts >= env.staff.maxFailedAttempts) {
    const lockUntil = new Date(Date.now() + env.staff.lockMinutes * 60 * 1000);
    await User.updateOne({ _id: userId }, { $set: { lockUntil, failedLoginAttempts: 0 } });
    throw lockedError(lockUntil);
  }
  return { ok: false, user };
}

// ================================================================== login

/** @returns {Promise<{ user: object, accessToken: string, refreshToken: string }>} */
export async function staffLogin({ username, password }) {
  const found = await User.findOne({ username }).select('+passwordHash role');
  if (!found || !isStaffRole(found.role) || !found.passwordHash) {
    await bcrypt.compare(password, await getDummyHash());
    throw invalidCredentials(); // same answer whether the username exists or not (and for customers)
  }

  const { ok, user } = await checkPasswordWithLockout(found._id, password);
  if (!ok) throw invalidCredentials();

  if (user.isActive === false) {
    throw ApiError.forbidden(ErrorCodes.ACCOUNT_DISABLED, 'This account has been deactivated');
  }

  const tokens = await issueTokenPair(user);
  return { user, ...tokens };
}

// ================================================================== password changes

export const revokeAllRefreshTokens = (userId) => RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

/**
 * Sets a new password without any "current password" check (admin reset, recovery script, seed): clears the lock,
 * ends every session of that user (refresh tokens revoked; access tokens older than passwordChangedAt are refused).
 */
export async function setPassword(user, password) {
  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.failedLoginAttempts = 0;
  user.lockUntil = undefined;
  await user.save();
  await revokeAllRefreshTokens(user._id);
}

/**
 * PATCH /me/password. Other devices are signed out; this session continues with the NEW token pair returned here
 * (the old access token stops working at once because it predates passwordChangedAt).
 */
export async function changeOwnPassword(userId, { currentPassword, newPassword }) {
  const { ok } = await checkPasswordWithLockout(userId, currentPassword);
  if (!ok) throw ApiError.badRequest(ErrorCodes.INVALID_CURRENT_PASSWORD, 'Current password is incorrect');
  if (currentPassword === newPassword) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Request validation failed', [
      { path: 'newPassword', message: 'New password must be different from the current one' },
    ]);
  }

  const user = await User.findById(userId);
  await setPassword(user, newPassword);
  const tokens = await issueTokenPair(user);
  return { ...tokens, passwordChangedAt: user.passwordChangedAt };
}

/** Throws USERNAME_TAKEN when another account already has this username. */
export async function assertUsernameFree(username, exceptUserId = null) {
  const taken = await User.exists({ username, ...(exceptUserId ? { _id: { $ne: exceptUserId } } : {}) });
  if (taken) throw ApiError.conflict(ErrorCodes.USERNAME_TAKEN, 'This username is already taken');
}

/** A duplicate-key error on `username` (a race past assertUsernameFree) becomes the same 409. */
export function mapUsernameDuplicate(err) {
  if (err?.code === 11000 && err?.keyPattern?.username) {
    return ApiError.conflict(ErrorCodes.USERNAME_TAKEN, 'This username is already taken');
  }
  return err;
}

// ================================================================== recovery (npm run admin:set-password)

/**
 * Sets the password of a staff account by username, for the recovery script. An account from before username login
 * existed (it has no username) is found by its mobile and given the username at the same time.
 * @throws {Error} with a message meant for the terminal
 */
export async function recoverStaffAccount({ username, password, mobile }) {
  const parsedName = usernameSchema.safeParse(username);
  if (!parsedName.success) throw new Error(parsedName.error.issues[0].message);
  const name = parsedName.data;
  const parsedPassword = passwordSchema.safeParse(password);
  if (!parsedPassword.success) throw new Error(parsedPassword.error.issues[0].message);

  let user = await User.findOne({ username: name });
  if (user && !isStaffRole(user.role)) throw new Error(`"${name}" belongs to a ${user.role}, not to an admin or rider`);

  if (!user) {
    if (!mobile) {
      const withoutUsername = await User.find({ role: { $in: STAFF_ROLES }, username: { $exists: false } }).select('name mobile role');
      const hint = withoutUsername.length
        ? ` Accounts without a username: ${withoutUsername.map((u) => `${u.name} (${u.role}, ${u.mobile})`).join('; ')}. Re-run with --mobile <mobile> to give one of them this username.`
        : '';
      throw new Error(`No admin or rider has the username "${name}".${hint}`);
    }
    user = await User.findOne({ mobile, role: { $in: STAFF_ROLES } });
    if (!user) throw new Error(`No admin or rider has the mobile ${mobile}`);
    if (user.username) throw new Error(`That account already has the username "${user.username}"; run the script with it`);
    user.username = name;
  }

  try {
    await setPassword(user, password);
  } catch (err) {
    throw mapUsernameDuplicate(err);
  }
  return { username: user.username, role: user.role, name: user.name };
}
