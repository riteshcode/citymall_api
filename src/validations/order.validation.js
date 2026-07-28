import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';

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
