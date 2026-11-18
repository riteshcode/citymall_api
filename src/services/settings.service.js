import { Setting } from '../models/Setting.js';
import { env } from '../config/env.js';

const KEY = 'store';

/** First-run values, taken from env. After the document exists, the DB is the source of truth. */
export function defaultSettings() {
  return {
    key: KEY,
    deliveryFee: env.pricing.deliveryFeePaise,
    freeDeliveryThreshold: env.pricing.freeDeliveryThresholdPaise,
    handlingFee: env.pricing.handlingFeePaise,
    minOrderValue: 0,
    storeOpen: true,
    storeTimings: { open: '08:00', close: '22:00' },
  };
}

/** Returns the singleton settings document, creating it from env defaults on first use. */
export async function getSettings() {
  let doc = await Setting.findOne({ key: KEY });
  if (doc) return doc;
  try {
    doc = await Setting.create(defaultSettings());
  } catch (err) {
    if (err?.code !== 11000) throw err;
    doc = await Setting.findOne({ key: KEY }); // lost the creation race to another request
  }
  return doc;
}

export async function updateSettings(patch) {
  const { storeTimings, ...rest } = patch;
  const $set = { ...rest };
  // Dot-paths so patching only `open` doesn't wipe `close`.
  if (storeTimings) {
    for (const [k, v] of Object.entries(storeTimings)) $set[`storeTimings.${k}`] = v;
  }
  await getSettings(); // make sure the document exists before updating
  return Setting.findOneAndUpdate({ key: KEY }, { $set }, { new: true, runValidators: true });
}

/** Public/admin response shape — explicit fields, no internal key or id. */
export function serializeSettings(doc) {
  return {
    deliveryFee: doc.deliveryFee,
    freeDeliveryThreshold: doc.freeDeliveryThreshold,
    handlingFee: doc.handlingFee,
    minOrderValue: doc.minOrderValue,
    storeOpen: doc.storeOpen,
    storeTimings: { open: doc.storeTimings.open, close: doc.storeTimings.close },
  };
}
