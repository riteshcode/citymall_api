import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * Reverse geocoding for "Delivering to G Block, Sector 63": (lat, lng) -> { pincode, area, city, state }, India only.
 *
 * Providers (GEO_PROVIDER): "nominatim" (OpenStreetMap, free; default) or "google" (GOOGLE_MAPS_API_KEY).
 * Coordinates are rounded to 3 decimals (~110 m) and results cached for 24 hours, so the provider is hit rarely.
 * Nominatim's usage policy is followed: an identifying User-Agent (GEO_USER_AGENT) and at most one request per second
 * (calls are queued and spaced GEO_NOMINATIM_MIN_INTERVAL_MS apart).
 */

/** The network calls behind one object so tests can swap them (ESM modules cannot be monkeypatched). */
export const geoTransport = { fetch: (...args) => fetch(...args) };

// A generous box around India: anything outside it is answered without bothering the provider.
const INDIA_BOX = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 97.5 };
const MAX_CACHE_ENTRIES = 5000;
const MAX_QUEUED_NOMINATIM_CALLS = 20;
const REQUEST_TIMEOUT_MS = 8000;

const notFound = () => ApiError.notFound(ErrorCodes.GEO_NOT_FOUND, 'No Indian address with a pincode was found for this location');
const providerError = (message = 'The location service is not available right now, please try again') =>
  new ApiError(502, ErrorCodes.GEO_PROVIDER_ERROR, message);

// ---------------------------------------------------------------- cache

const cache = new Map(); // "lat,lng" -> { expiresAt, value: {pincode,area,city,state} | null (= nothing found there) }
const inflight = new Map(); // "lat,lng" -> Promise, so a burst for one spot makes one provider call

export function clearGeoCache() {
  cache.clear();
  inflight.clear();
}

function cacheSet(key, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value); // oldest first
  cache.set(key, { expiresAt: Date.now() + env.geo.cacheTtlMs, value });
}

// ---------------------------------------------------------------- Nominatim (OpenStreetMap)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let nominatimChain = Promise.resolve();
let nominatimLastCall = 0;
let nominatimQueued = 0;

/** Runs `fn` once the previous Nominatim call is at least the minimum interval behind (1 request / second policy). */
function spaced(fn) {
  if (nominatimQueued >= MAX_QUEUED_NOMINATIM_CALLS) throw providerError('The location service is busy, please try again');
  nominatimQueued += 1;
  const run = nominatimChain.then(async () => {
    // clamped to the interval: a clock that jumped backwards must never stall the queue for hours
    const wait = Math.min(nominatimLastCall + env.geo.nominatimMinIntervalMs - Date.now(), env.geo.nominatimMinIntervalMs);
    if (wait > 0) await sleep(wait);
    nominatimLastCall = Date.now();
    return fn();
  });
  const settled = run.catch(() => {});
  nominatimChain = settled;
  settled.then(() => {
    nominatimQueued -= 1;
  });
  return run;
}

const unique = (parts) => [...new Set(parts.filter(Boolean))];
const pincodeOf = (raw) => String(raw ?? '').replace(/\s+/g, '').match(/^[1-9]\d{5}$/)?.[0] ?? null;

function parseNominatim(body) {
  const a = body?.address;
  if (!a || String(a.country_code).toLowerCase() !== 'in') return null;
  const pincode = pincodeOf(a.postcode);
  if (!pincode) return null;

  const city = a.city || a.town || a.village || a.municipality || a.county || a.state_district || '';
  const locality = unique([a.neighbourhood || a.quarter || a.residential || a.hamlet, a.suburb || a.city_district]).join(', ');
  return { pincode, area: locality || a.village || city, city, state: a.state || '' };
}

async function reverseNominatim(lat, lng) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.search = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lng), zoom: '18', addressdetails: '1', 'accept-language': 'en' }).toString();

  const body = await spaced(async () => {
    let res;
    try {
      res = await geoTransport.fetch(url, {
        headers: { 'User-Agent': env.geo.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      logger.warn(`[Geo:nominatim] request failed: ${err.message}`);
      throw providerError();
    }
    if (!res.ok) {
      logger.warn(`[Geo:nominatim] HTTP ${res.status}`);
      throw providerError();
    }
    return res.json().catch(() => null);
  });

  if (!body) throw providerError();
  return parseNominatim(body); // body.error ("Unable to geocode") has no address -> null
}

// ---------------------------------------------------------------- Google

function parseGoogle(body) {
  const components = (body.results ?? []).flatMap((r) => r.address_components ?? []);
  const get = (type, key = 'long_name') => components.find((c) => c.types?.includes(type))?.[key];

  if (get('country', 'short_name') !== 'IN') return null;
  const pincode = pincodeOf(get('postal_code'));
  if (!pincode) return null;

  const city = get('locality') || get('administrative_area_level_3') || get('administrative_area_level_2') || '';
  const locality = unique([get('neighborhood') || get('sublocality_level_2'), get('sublocality_level_1') || get('sublocality')]).join(', ');
  return { pincode, area: locality || city, city, state: get('administrative_area_level_1') || '' };
}

async function reverseGoogle(lat, lng) {
  if (!env.geo.googleApiKey) throw new ApiError(503, ErrorCodes.GEO_NOT_CONFIGURED, 'The location service is not configured on the server');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.search = new URLSearchParams({ latlng: `${lat},${lng}`, language: 'en', region: 'in', key: env.geo.googleApiKey }).toString();

  let res;
  try {
    res = await geoTransport.fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    logger.warn(`[Geo:google] request failed: ${err.message}`); // never log the URL: it carries the API key
    throw providerError();
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body) {
    logger.warn(`[Geo:google] HTTP ${res.status}`);
    throw providerError();
  }
  if (body.status === 'ZERO_RESULTS') return null;
  if (body.status !== 'OK') {
    logger.warn(`[Geo:google] ${body.status}: ${body.error_message ?? ''}`);
    throw providerError();
  }
  return parseGoogle(body);
}

const providers = { nominatim: reverseNominatim, google: reverseGoogle };

// ---------------------------------------------------------------- public API

/**
 * @returns {Promise<{ pincode: string, area: string, city: string, state: string }>}
 * @throws 404 GEO_NOT_FOUND (outside India / no pincode there), 502 GEO_PROVIDER_ERROR, 503 GEO_NOT_CONFIGURED
 */
export async function reverseGeocode(lat, lng) {
  if (lat < INDIA_BOX.minLat || lat > INDIA_BOX.maxLat || lng < INDIA_BOX.minLng || lng > INDIA_BOX.maxLng) throw notFound();

  const rlat = Number(lat.toFixed(3));
  const rlng = Number(lng.toFixed(3));
  const key = `${rlat.toFixed(3)},${rlng.toFixed(3)}`;

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    if (!hit.value) throw notFound();
    return { ...hit.value };
  }

  const lookup = providers[env.geo.provider];
  if (!lookup) throw new ApiError(503, ErrorCodes.GEO_NOT_CONFIGURED, `Unknown GEO_PROVIDER "${env.geo.provider}"`);

  let pending = inflight.get(key);
  if (!pending) {
    pending = lookup(rlat, rlng)
      .then((value) => {
        cacheSet(key, value); // "nothing found" is cached too; provider failures are not
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }

  const value = await pending;
  if (!value) throw notFound();
  return { ...value };
}
