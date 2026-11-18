import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

/** A delivery area. GET /serviceability and checkout both read this collection. */
const pincodeSchema = new mongoose.Schema(
  {
    pincode: { type: String, required: true, unique: true, trim: true, match: /^[1-9]\d{5}$/ },
    areaName: { type: bilingualSchema, required: true },
    isActive: { type: Boolean, default: true },
    // Paise. null => use the store-wide Setting.deliveryFee. (Free-delivery threshold still applies on top.)
    deliveryFee: { type: Number, default: null, min: 0 },
    etaDays: { type: Number, default: 2, min: 0, max: 30 },
  },
  { timestamps: true }
);

pincodeSchema.index({ isActive: 1, pincode: 1 });

toJSONPlugin(pincodeSchema);

export const Pincode = mongoose.model('Pincode', pincodeSchema);
