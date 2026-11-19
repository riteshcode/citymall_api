import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { addressSchema } from './shared/address.js';
import { bilingualSchema } from './shared/bilingual.js';

const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    // Snapshot of the chosen variant (both null for products without variants / orders from before variants existed).
    // Stock is returned to this variant if the order is cancelled.
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    variantLabel: { type: bilingualSchema, default: null },
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

// One refund of an online payment (see services/refund.service.js). The order-level refund fields summarise these.
const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, default: null }, // the gateway's id (null until the gateway has answered)
    amount: { type: Number, required: true, min: 1 }, // paise
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    reason: { type: String, default: '' },
    source: { type: String, enum: ['cancel', 'admin', 'gateway'], default: 'admin' }, // gateway = made outside this API
    failureReason: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null },
  },
  { _id: true }
);
toJSONPlugin(refundSchema);

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
    // Earlier gateway orders of this order (replaced by a payment retry or a switch to COD). Kept so a late
    // webhook for an abandoned attempt can still be matched to the order. Never serialised.
    previousProviderOrderIds: { type: [String], default: [], private: true },
    // Gateway payment id (e.g. Razorpay pay_xxx), set when payment is verified / captured.
    paymentId: { type: String, default: null },
    cancelReason: { type: String, default: null },
    // Refund summary (recomputed from `refunds`): the status of the latest refund, its gateway id, the total refunded so
    // far (processed only) and when. paymentStatus turns "refunded" only once processed refunds cover the whole amount.
    refundStatus: { type: String, enum: ['pending', 'processed', 'failed', null], default: null },
    refundId: { type: String, default: null },
    refundedAmount: { type: Number, default: 0, min: 0 },
    refundedAt: { type: Date, default: null },
    refunds: { type: [refundSchema], default: [] },
    deliveryNote: { type: String, trim: true, maxlength: 200, default: '' },
    // 4-digit code the customer reads out to the rider. `private`: stripped from every serialisation; only the
    // customer-facing order endpoints add it back explicitly. Never shown to admin or rider APIs.
    deliveryOtp: { type: String, default: null, private: true },
    deliveryOtpAttempts: { type: Number, default: 0, private: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // Paise the rider reports having collected (COD only), set when the order is delivered.
    cashCollected: { type: Number, min: 0, default: null },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ rider: 1, status: 1, createdAt: -1 });

toJSONPlugin(orderSchema);

export const Order = mongoose.model('Order', orderSchema);
