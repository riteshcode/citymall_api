import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { addressSchema } from './shared/address.js';

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    title: {
      en: { type: String, required: true },
      hi: { type: String, required: true },
    },
    image: { type: String, default: '' },
    unit: { type: String, required: true },
    price: { type: Number, required: true, min: 0 }, // paise, at time of order
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const pricingSchema = new mongoose.Schema(
  {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    deliveryFee: { type: Number, required: true, min: 0, default: 0 },
    handlingFee: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      required: true,
    },
    at: { type: Date, default: Date.now },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true, validate: (v) => v.length > 0 },
    pricing: { type: pricingSchema, required: true },
    couponCode: { type: String, default: null },
    shippingAddress: { type: addressSchema, required: true },
    paymentMethod: { type: String, enum: ['cod', 'upi', 'card', 'netbanking'], required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    status: {
      type: String,
      enum: ['placed', 'confirmed', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
      default: 'placed',
    },
    statusHistory: { type: [statusHistorySchema], default: [] },
    expectedDeliveryAt: { type: Date, default: null },
    idempotencyKey: { type: String, required: true, unique: true },
    paymentProviderOrderId: { type: String, default: null },
    cancelReason: { type: String, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });

toJSONPlugin(orderSchema);

export const Order = mongoose.model('Order', orderSchema);
