import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

/** A browser's Web Push subscription (PWA). One row per browser/device; `endpoint` is globally unique. */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, default: null },
    // Encryption secrets for this subscription — never serialised.
    keys: {
      p256dh: { type: String, required: true, private: true },
      auth: { type: String, required: true, private: true },
    },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

toJSONPlugin(pushSubscriptionSchema);

export const PushSubscription = mongoose.model('PushSubscription', pushSubscriptionSchema);
