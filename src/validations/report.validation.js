import { z } from 'zod';
import { parseDateBoundary } from '../utils/dates.js';

// YYYY-MM-DD = the whole IST day; an ISO datetime is used as given.
const dateParam = z
  .string()
  .trim()
  .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Use YYYY-MM-DD or an ISO datetime' });

const rangeIsOrdered = (v) => !v.from || !v.to || parseDateBoundary(v.from, 'start') <= parseDateBoundary(v.to, 'end');
const rangeError = { message: '"from" must not be after "to"', path: ['from'] };

export const salesReportSchema = {
  query: z
    .object({
      from: dateParam.optional(), // default: 30 days before `to`
      to: dateParam.optional(), // default: today (IST)
      groupBy: z.enum(['day', 'week', 'month']).default('day'),
    })
    .strict()
    .refine(rangeIsOrdered, rangeError),
};

export const topProductsSchema = {
  query: z
    .object({
      from: dateParam.optional(),
      to: dateParam.optional(),
      limit: z.coerce.number().int().min(1).max(50).default(10),
    })
    .strict()
    .refine(rangeIsOrdered, rangeError),
};

export const codReportSchema = {
  query: z
    .object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
        .refine((v) => parseDateBoundary(v, 'start') !== null, { message: 'Not a real date' }),
    })
    .strict(),
};
