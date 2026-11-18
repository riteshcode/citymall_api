import { env } from '../config/env.js';

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const offsetMs = () => env.storeUtcOffsetMinutes * MINUTE;

/** Start (00:00) of the store's local day containing `date` — IST by default, not the server's UTC day. */
export function startOfStoreDay(date = new Date()) {
  const shifted = new Date(date.getTime() + offsetMs());
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - offsetMs());
}

/**
 * Parses a `from` / `to` query value.
 *  - "YYYY-MM-DD"  -> that whole store-local day (edge 'start' = 00:00:00.000, edge 'end' = 23:59:59.999)
 *  - ISO datetime  -> used as-is
 * Returns null when the value is not a real date.
 */
export function parseDateBoundary(value, edge) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    // Date.UTC silently rolls 2026-02-31 over to March; reject that.
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    const startUtc = probe.getTime() - offsetMs();
    return new Date(edge === 'start' ? startUtc : startUtc + DAY - 1);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** The store-local (IST) calendar date of `date` as YYYY-MM-DD. */
export function formatStoreDate(date = new Date()) {
  return new Date(date.getTime() + offsetMs()).toISOString().slice(0, 10);
}

/** "+05:30"-style UTC offset string for MongoDB's `timezone` option, derived from STORE_UTC_OFFSET_MINUTES. */
export function storeTimezoneOffset() {
  const total = env.storeUtcOffsetMinutes;
  const sign = total < 0 ? '-' : '+';
  const abs = Math.abs(total);
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** The store-local date `days` days after (negative = before) a YYYY-MM-DD date. */
export function addDaysToStoreDate(dateString, days) {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
