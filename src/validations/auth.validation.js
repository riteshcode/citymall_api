import { z } from 'zod';
import { mobileSchema, passwordSchema } from '../utils/zodHelpers.js';

export const sendOtpSchema = {
  body: z
    .object({
      mobile: mobileSchema,
      purpose: z.enum(['login', 'signup']).default('login'),
    })
    .strict(),
};

export const verifyOtpSchema = {
  body: z
    .object({
      mobile: mobileSchema,
      code: z.string().trim().regex(/^\d{4,8}$/, 'OTP must be numeric'),
      purpose: z.enum(['login', 'signup']).default('login'),
      name: z.string().trim().min(1).max(80).optional(), // used to set the name on first signup
    })
    .strict(),
};

export const refreshSchema = {
  body: z
    .object({
      refreshToken: z.string().min(10),
    })
    .strict(),
};

export const logoutSchema = {
  body: z
    .object({
      refreshToken: z.string().min(10),
    })
    .strict(),
};

export const updateMeSchema = {
  body: z
    .object({
      name: z.string().trim().min(1).max(80).optional(),
      email: z.string().trim().email().optional(),
    })
    .strict(),
};

// ---- staff (admin / rider) username + password
export const staffLoginSchema = {
  body: z
    .object({
      // Deliberately lenient: no format hints for an attacker, a wrong shape is simply "incorrect username or password".
      username: z.string().trim().toLowerCase().min(1).max(64),
      password: z.string().min(1).max(128),
    })
    .strict(),
};

export const changePasswordSchema = {
  body: z
    .object({
      currentPassword: z.string().min(1).max(128),
      newPassword: passwordSchema,
    })
    .strict(),
};
