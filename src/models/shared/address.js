import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoosePlugins.js';

/** Full address shape shared between User.addresses[] and Order.shippingAddress snapshot. */
export const addressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, default: 'Home' },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true, trim: true, match: /^[1-9]\d{5}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Applied here (not just on top-level models) so nested addresses inside
// User.addresses[] and Order.shippingAddress also serialise _id -> id.
toJSONPlugin(addressSchema);
