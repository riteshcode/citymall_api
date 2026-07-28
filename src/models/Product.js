import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const productSchema = new mongoose.Schema(
  {
    title: { type: bilingualSchema, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: bilingualSchema, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true, default: '' },
    images: { type: [String], default: [] },
    // All money in integer paise.
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true }, // e.g. "1 kg", "500 ml"
    stock: { type: Number, required: true, min: 0, default: 0 },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.virtual('discountPercent').get(function () {
  if (!this.mrp || this.mrp <= 0 || this.price >= this.mrp) return 0;
  return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

// Search
productSchema.index({ 'title.en': 'text', 'title.hi': 'text', tags: 'text' });

// Common catalog filter/sort combinations
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, ratingAvg: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });

toJSONPlugin(productSchema);

export const Product = mongoose.model('Product', productSchema);
