import { sendNotification, setVapidDetails } from 'web-push';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { PushSubscription } from '../models/PushSubscription.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { getSettings } from './settings.service.js';

/**
 * Web Push (PWA) notifications. Everything here is best-effort and NEVER throws into the caller: a push failure
 * must not break an order status change.
 */

const MAX_SUBSCRIPTIONS_PER_USER = 10;

/** The web-push calls behind one mutable object: ESM namespaces can't be monkeypatched, so tests swap these. */
export const transport = { sendNotification, setVapidDetails };

// The server POSTs to whatever endpoint a client registers, so accepting arbitrary URLs would be an SSRF hole.
// Only the browser vendors' push services (and anything added via PUSH_EXTRA_ALLOWED_HOSTS) are accepted.
const BUILT_IN_PUSH_HOSTS = ['fcm.googleapis.com', 'push.services.mozilla.com', 'notify.windows.com', 'push.apple.com'];

const hostMatches = (host, suffix) => host === suffix || host.endsWith(`.${suffix}`);

export function isAllowedPushEndpoint(endpoint) {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
  const host = url.hostname.toLowerCase();
  return [...BUILT_IN_PUSH_HOSTS, ...env.push.extraAllowedHosts].some((suffix) => hostMatches(host, suffix));
}

export const isPushConfigured = () => Boolean(env.push.publicKey && env.push.privateKey);

function requireConfigured() {
  if (!isPushConfigured()) {
    throw new ApiError(503, ErrorCodes.PUSH_NOT_CONFIGURED, 'Push notifications are not configured on the server');
  }
}

export function getVapidPublicKey() {
  requireConfigured();
  return env.push.publicKey;
}

/** Registers (or re-registers) a browser subscription for the user. An endpoint belongs to one user at a time. */
export async function subscribe(userId, subscription, userAgent = '') {
  requireConfigured();
  if (!isAllowedPushEndpoint(subscription.endpoint)) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Unsupported push service endpoint');
  }

  const doc = await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      user: userId, // a shared device that switches account moves the subscription to the new user
      expirationTime: subscription.expirationTime ?? null,
      keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      userAgent: String(userAgent).slice(0, 300),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );

  // Keep only the newest MAX_SUBSCRIPTIONS_PER_USER browsers per user.
  const stale = await PushSubscription.find({ user: userId })
    .sort({ updatedAt: -1 })
    .skip(MAX_SUBSCRIPTIONS_PER_USER)
    .select('_id')
    .lean();
  if (stale.length) await PushSubscription.deleteMany({ _id: { $in: stale.map((s) => s._id) } });

  return doc;
}

/** @returns {Promise<number>} how many subscriptions were removed (0 if it wasn't the user's / didn't exist) */
export async function unsubscribe(userId, endpoint) {
  const { deletedCount } = await PushSubscription.deleteOne({ user: userId, endpoint });
  return deletedCount;
}

// ---------------------------------------------------------------- sending

const inFlight = new Set();

async function sendToUser(userId, payload) {
  if (!isPushConfigured()) return;
  const subscriptions = await PushSubscription.find({ user: userId });
  if (subscriptions.length === 0) return;

  transport.setVapidDetails(env.push.subject, env.push.publicKey, env.push.privateKey);
  const body = JSON.stringify(payload);

  const gone = [];
  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await transport.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
          body,
          { TTL: 24 * 60 * 60, timeout: 10_000 }
        );
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          gone.push(sub._id); // the browser unsubscribed / the subscription expired: it will never work again
        } else {
          logger.warn(`[Push] send failed (${err?.statusCode ?? 'no status'}): ${err?.message ?? err}`);
        }
      }
    })
  );

  // One batched delete instead of one concurrent deleteOne per dead device: a single round trip, and it avoids a
  // concurrent-deleteOne pattern that reliably crashes the in-memory mongod (6.0.14, Windows) the tests run on.
  if (gone.length) await PushSubscription.deleteMany({ _id: { $in: gone } });
}

/** Fire-and-forget. Returns the promise only so tests can await it (see flushPushQueue). Never rejects. */
export function notifyUser(userId, payload) {
  const task = sendToUser(userId, payload).catch((err) => logger.warn(`[Push] ${err?.message ?? err}`));
  inFlight.add(task);
  task.finally(() => inFlight.delete(task));
  return task;
}

/** Resolves when every in-flight notification has finished. For tests / graceful shutdown. */
export async function flushPushQueue() {
  await Promise.allSettled([...inFlight]);
}

// Customers have no stored language, so each message carries English and Hindi together.
const STATUS_MESSAGES = {
  confirmed: ['Your order is confirmed', 'आपका ऑर्डर कन्फर्म हो गया है'],
  packed: ['Your order is packed', 'आपका ऑर्डर पैक हो गया है'],
  shipped: ['Your order has been shipped', 'आपका ऑर्डर भेज दिया गया है'],
  out_for_delivery: ['Your order is out for delivery', 'आपका ऑर्डर डिलीवरी के लिए निकल चुका है'],
  delivered: ['Your order was delivered', 'आपका ऑर्डर डिलीवर हो गया है'],
  cancelled: ['Your order was cancelled', 'आपका ऑर्डर रद्द कर दिया गया है'],
};

/**
 * Tells the order's customer that its status changed: { title, body, url: "/orders/<id>" }.
 * ("placed" is skipped — the customer just did that. The delivery OTP is deliberately never put in a push.)
 */
export function notifyOrderStatusChange(order) {
  const message = STATUS_MESSAGES[order.status];
  if (!message || !isPushConfigured()) return Promise.resolve();

  const customerId = order.user?._id ?? order.user;
  const task = (async () => {
    const { storeName } = await getSettings();
    await sendToUser(customerId, {
      title: storeName || 'Aali Market',
      body: `${message[0]} / ${message[1]} (#${order.orderNumber})`,
      url: `/orders/${order.id}`,
    });
  })().catch((err) => logger.warn(`[Push] ${err?.message ?? err}`));
  inFlight.add(task);
  task.finally(() => inFlight.delete(task));
  return task;
}

// ---------------------------------------------------------------- rider notifications

const shortOrderRef = (order) => `#${String(order.orderNumber).slice(-6)}`;
/** Where to: the area (address line 2) when there is one, else the city. Never the phone, the door number or the OTP. */
const dropArea = (order) => order.shippingAddress?.line2?.trim() || order.shippingAddress?.city || '';

/** Tells a rider an order was assigned to them: { title, body: "#<last 6 of orderNumber>, <area/city>", url: "/rider" }. */
export function notifyRiderAssigned(riderId, order) {
  return notifyUser(riderId, {
    title: 'New delivery / नई डिलीवरी',
    body: [shortOrderRef(order), dropArea(order)].filter(Boolean).join(', '),
    url: '/rider',
  });
}

/** Tells a rider an order was taken away from them (given to someone else, or unassigned). */
export function notifyRiderUnassigned(riderId, order) {
  return notifyUser(riderId, {
    title: 'Order reassigned / ऑर्डर बदला गया',
    body: `${shortOrderRef(order)} is no longer yours / अब आपका नहीं है`,
    url: '/rider',
  });
}
