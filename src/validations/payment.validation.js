import { z } from 'zod';
import { objectIdSchema } from '../utils/zodHelpers.js';

export const verifyPaymentSchema = {
  body: z
    .object({
      orderId: objectIdSchema, // our order id (not Razorpay's)
      razorpay_payment_id: z.string().trim().min(3).max(100),
      razorpay_signature: z.string().trim().min(1).max(256),
      // Razorpay's checkout callback also returns this; accepted so clients can forward the whole
      // payload as-is. It is only cross-checked — the signature is always verified against the
      // provider order id stored on our order.
      razorpay_order_id: z.string().trim().min(3).max(100).optional(),
    })
    .strict(),
};
