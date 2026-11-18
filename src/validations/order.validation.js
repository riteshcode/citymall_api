import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';
import { parseDateBoundary } from '../utils/dates.js';

export const createOrderSchema = {
  body: z
    .object({
      addressId: objectIdSchema,
      paymentMethod: z.enum(['cod', 'upi', 'card', 'netbanking']),
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
