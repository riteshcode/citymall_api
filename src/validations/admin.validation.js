import { z } from 'zod';
import { objectIdSchema, pageQuerySchema } from '../utils/zodHelpers.js';

// NOT z.coerce.boolean(): Boolean("false") === true.
const boolParam = z.enum(['true', 'false']).transform((v) => v === 'true');

export const adminListUsersSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(40).optional(), // name or mobile, substring
  }),
};

export const adminListProductsSchema = {
  query: pageQuerySchema.extend({
    q: z.string().trim().min(1).max(80).optional(), // title (en/hi), slug, brand, tag — substring
    category: objectIdSchema.optional(),
    isActive: boolParam.optional(),
    lowStock: boolParam.optional(),
  }),
};
