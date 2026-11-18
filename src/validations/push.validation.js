import { z } from 'zod';

const decodedLength = (n) => (value) => Buffer.from(value, 'base64url').length === n;

// Exactly what `PushSubscription.toJSON()` produces in the browser.
export const pushSubscriptionSchema = {
  body: z
    .object({
      endpoint: z.string().trim().url().max(2048),
      expirationTime: z.number().nullable().optional(),
      keys: z
        .object({
          p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(decodedLength(65), 'p256dh must be a 65-byte public key'),
          auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).refine(decodedLength(16), 'auth must be a 16-byte secret'),
        })
        .strict(),
    })
    .strict(),
};

export const removePushSubscriptionSchema = {
  body: z.object({ endpoint: z.string().trim().url().max(2048) }).strict(),
};
