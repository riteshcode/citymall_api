import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * PaymentProvider interface every provider must implement:
 *   createOrder({ amountPaise, currency, receipt }): Promise<{ id, amount, currency, status }>
 *   verifySignature({ rawBody, signature }): boolean
 * The shape mirrors Razorpay's Orders API so swapping the mock for the real
 * SDK later is a drop-in change (checkout.js just needs providerOrderId).
 */

const mockProvider = {
  async createOrder({ amountPaise, currency = 'INR', receipt }) {
    const id = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
    logger.info(`[Payments:mock] created order ${id} for ${amountPaise} paise (receipt=${receipt})`);
    return { id, amount: amountPaise, currency, status: 'created' };
  },

  // In mock mode any non-empty signature is accepted so local/dev checkout works end to end.
  verifySignature({ signature }) {
    return Boolean(signature);
  },
};

const razorpayShapedProvider = {
  async createOrder({ amountPaise, currency = 'INR', receipt }) {
    // Swap this for `new Razorpay(...).orders.create(...)` when going live.
    const id = `order_rzp_${crypto.randomBytes(8).toString('hex')}`;
    return { id, amount: amountPaise, currency, status: 'created' };
  },

  /** Razorpay webhook signature = HMAC-SHA256(rawBody, webhookSecret), hex-encoded. */
  verifySignature({ rawBody, signature }) {
    if (!signature) return false;
    const expected = crypto
      .createHmac('sha256', env.payments.webhookSecret)
      .update(rawBody)
      .digest('hex');
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  },
};

const providers = {
  mock: mockProvider,
  razorpay: razorpayShapedProvider,
};

export function getPaymentProvider() {
  return providers[env.payments.provider] || mockProvider;
}
