import { Pincode } from '../models/Pincode.js';

const DEFAULT_ETA_DAYS = 2;

/**
 * Resolves delivery info for a pincode from the Pincode collection.
 *
 * Open mode: while NO pincode documents exist at all (nothing configured yet), every pincode is served
 * with the default ETA and the store-wide delivery fee — so a fresh install isn't dead until an admin
 * adds areas. As soon as one document exists, only active listed pincodes are serviceable.
 *
 * @returns {{ serviceable: boolean, etaDays: number|null, etaMinutes: number|null, areaName: object|null, deliveryFeeOverride: number|null }}
 *   etaMinutes (5-1440) is set for quick-delivery areas and then takes precedence over etaDays.
 */
export async function resolveDelivery(pincode) {
  if ((await Pincode.estimatedDocumentCount()) === 0) {
    return { serviceable: true, etaDays: DEFAULT_ETA_DAYS, etaMinutes: null, areaName: null, deliveryFeeOverride: null };
  }

  const doc = await Pincode.findOne({ pincode, isActive: true });
  if (!doc) return { serviceable: false, etaDays: null, etaMinutes: null, areaName: null, deliveryFeeOverride: null };

  return {
    serviceable: true,
    etaDays: doc.etaDays,
    etaMinutes: doc.etaMinutes ?? null,
    areaName: { en: doc.areaName.en, hi: doc.areaName.hi },
    deliveryFeeOverride: doc.deliveryFee,
  };
}

/** When an order placed `from` should arrive: etaMinutes for quick-delivery areas, otherwise etaDays. */
export function expectedDeliveryAt(delivery, from = Date.now()) {
  if (delivery.etaMinutes != null) return new Date(from + delivery.etaMinutes * 60 * 1000);
  return new Date(from + delivery.etaDays * 24 * 60 * 60 * 1000);
}
