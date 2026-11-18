import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/**
 * Singleton store configuration (exactly one document, key = 'store').
 * Money fields are integer paise. Replaces the delivery/handling values that used to be env-only;
 * the env values are now just the defaults used to create this document the first time.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'store', private: true },
    deliveryFee: { type: Number, required: true, min: 0 },
    // Delivery is free once subtotal >= this. 0 means delivery is always free.
    freeDeliveryThreshold: { type: Number, required: true, min: 0 },
    handlingFee: { type: Number, required: true, min: 0 },
    // Orders with a subtotal below this are rejected at checkout. 0 = no minimum.
    minOrderValue: { type: Number, required: true, min: 0, default: 0 },
    // false => POST /orders is rejected with STORE_CLOSED.
    storeOpen: { type: Boolean, required: true, default: true },
    // Public store details (legal pages, invoices, contact). Empty string = not filled in yet.
    storeName: { type: String, trim: true, default: 'Aali Market' },
    phone: { type: String, trim: true, default: '' },
    whatsapp: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    address: {
      line1: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      state: { type: String, trim: true, default: '' },
      pincode: { type: String, trim: true, default: '' },
    },
    fssaiNumber: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    // Display-only ("HH:mm", 24h). Not enforced automatically.
    storeTimings: {
      open: { type: String, required: true, default: '08:00' },
      close: { type: String, required: true, default: '22:00' },
    },
  },
  { timestamps: true }
);

toJSONPlugin(settingSchema);

export const Setting = mongoose.model('Setting', settingSchema);
