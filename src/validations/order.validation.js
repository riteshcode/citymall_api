import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';
import { parseDateBoundary } from '../utils/dates.js';

export const createOrderSchema = {
  body: z
    .object({
      addressId: objectIdSchema,
      paymentMethod: z.enum(['cod', 'upi', 'card', 'netbanking']),
      deliveryNote: z.string().trim().max(200).optional(),
    })
    .strict(),
};

export const listOrdersSchema = {
  query: pageQuerySchema,
};

const dateParam = z
  .string()
  .trim()
  .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Use YYYY-MM-DD or an ISO datetime' });

export const adminListOrdersSchema = {
  query: pageQuerySchema
    .extend({
      status: z.enum(['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']).optional(),
      from: dateParam.optional(), // YYYY-MM-DD = start of that IST day
      to: dateParam.optional(), // YYYY-MM-DD = end of that IST day (inclusive)
      q: z.string().trim().min(1).max(40).optional(), // orderNumber OR customer mobile, substring
    })
    .refine((v) => !v.from || !v.to || parseDateBoundary(v.from, 'start') <= parseDateBoundary(v.to, 'end'), {
      message: '"from" must not be after "to"',
      path: ['from'],
    }),
};

export const orderIdParamSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
};

export const cancelOrderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      reason: z.string().trim().max(300).optional(),
    })
    .strict(),
};

export const updateOrderStatusSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z
    .object({
      status: z.enum(['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']),
      note: z.string().trim().max(300).optional(),
    })
    .strict(),
};

// Online payment retry / switch to COD / reorder: the order id is the only input.
export const retryPaymentSchema = { params: z.object({ id: objectIdSchema }).strict() };
export const reorderSchema = { params: z.object({ id: objectIdSchema }).strict() };

export const changePaymentMethodSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  body: z.object({ paymentMethod: z.literal('cod') }).strict(),
};

export const assignRiderSchema = {
  params: z.object({ id: objectIdSchema }).strict(),
  // riderId: null unassigns
  body: z.object({ riderId: objectIdSchema.nullable() }).strict(),
};

export const latestOrdersSchema = {
  query: z
    .object({
      // ISO datetime WITH a zone (e.g. 2026-11-18T10:30:00.000Z or ...+05:30) — what Date#toISOString() gives
      since: z.string().datetime({ offset: true }).transform((v) => new Date(v)),
    })
    .strict(),
};
