import { z } from 'zod';

// Plain decimal strings only: z.coerce.number() would turn an empty "?lat=" into 0.
const coordinate = (min, max) =>
  z
    .string()
    .regex(/^-?\d{1,3}(\.\d+)?$/, 'Must be a decimal number')
    .transform(Number)
    .pipe(z.number().min(min).max(max));

export const reverseGeocodeSchema = {
  query: z.object({ lat: coordinate(-90, 90), lng: coordinate(-180, 180) }).strict(),
};
