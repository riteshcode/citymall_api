import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    // Price (paise) captured when the item was added — for display only.
    // pricing.service.js always re-reads the live Product price for totals.
    priceAtAdd: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String, uppercase: true, trim: true, default: null },
  },
  { timestamps: true }
);

toJSONPlugin(cartSchema);

export const Cart = mongoose.model('Cart', cartSchema);
