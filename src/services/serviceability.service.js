import { Pincode } from '../models/Pincode.js';

const DEFAULT_ETA_DAYS = 2;

/**
 * Resolves delivery info for a pincode from the Pincode collection.
 *
 * Open mode: while NO pincode documents exist at all (nothing configured yet), every pincode is served
 * with the default ETA and the store-wide delivery fee — so a fresh install isn't dead until an admin
 * adds areas. As soon as one document exists, only active listed pincodes are serviceable.
 *
 * @returns {{ serviceable: boolean, etaDays: number|null, areaName: object|null, deliveryFeeOverride: number|null }}
 */
export async function resolveDelivery(pincode) {
  if ((await Pincode.estimatedDocumentCount()) === 0) {
    return { serviceable: true, etaDays: DEFAULT_ETA_DAYS, areaName: null, deliveryFeeOverride: null };
  }

  const doc = await Pincode.findOne({ pincode, isActive: true });
  if (!doc) return { serviceable: false, etaDays: null, areaName: null, deliveryFeeOverride: null };

  return {
    serviceable: true,
    etaDays: doc.etaDays,
    areaName: { en: doc.areaName.en, hi: doc.areaName.hi },
    deliveryFeeOverride: doc.deliveryFee,
  };
}
