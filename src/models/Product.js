import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

export const MAX_VARIANTS = 20;

const discountOf = (mrp, price) => (!mrp || mrp <= 0 || price >= mrp ? 0 : Math.round(((mrp - price) / mrp) * 100));

/**
 * One purchasable option of a product (e.g. "Aata 5 kg"). Money in integer paise.
 * A product WITH variants sells only through them: its top-level price / mrp / unit / stock are derived (see the
 * pre-validate hook below) so listing, sorting, filters and suggest keep working unchanged.
 */
const variantSchema = new mongoose.Schema(
  {
    label: { type: bilingualSchema, required: true },
    sku: { type: String, trim: true, default: '' },
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: { type: [String], default: [] }, // empty = use the product's images
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

variantSchema.virtual('discountPercent').get(function () {
  return discountOf(this.mrp, this.price);
});
variantSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});
toJSONPlugin(variantSchema);

const productSchema = new mongoose.Schema(
  {
    title: { type: bilingualSchema, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: bilingualSchema, required: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: String, trim: true, default: '' },
    images: { type: [String], default: [] },
    // All money in integer paise. With variants these four are DERIVED from them (see the hook below).
    mrp: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true }, // e.g. "1 kg", "500 ml"
    stock: { type: Number, required: true, min: 0, default: 0 },
    // What the options are called, e.g. { en: "Pack size", hi: "पैक साइज़" }. null when there are no variants.
    optionName: { type: bilingualSchema, default: null },
    variants: { type: [variantSchema], default: [] },
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    tags: { type: [String], default: [], index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.virtual('discountPercent').get(function () {
  return discountOf(this.mrp, this.price);
});

productSchema.virtual('inStock').get(function () {
  return this.stock > 0;
});

/**
 * Keeps the top-level fields consistent with the variants (runs on every save / create):
 *   price / mrp / unit = the default variant's (unit = its English label), stock = total of the ACTIVE variants.
 * Also guards the invariants the admin API validates up front, so no code path can store a broken product.
 */
productSchema.pre('validate', function syncFromVariants(next) {
  const variants = this.variants ?? [];
  if (variants.length === 0) {
    if (this.optionName) this.optionName = null;
    return next();
  }

  if (variants.length > MAX_VARIANTS) this.invalidate('variants', `At most ${MAX_VARIANTS} variants`);
  if (!this.optionName) this.invalidate('optionName', 'optionName is required when a product has variants');

  const defaults = variants.filter((v) => v.isDefault);
  if (defaults.length !== 1) this.invalidate('variants', 'Exactly one variant must be the default');
  const def = defaults[0];
  if (def && !def.isActive) this.invalidate('variants', 'The default variant must be active');
  if (variants.some((v) => v.price > v.mrp)) this.invalidate('variants', 'A variant price cannot exceed its mrp');

  if (def) {
    this.price = def.price;
    this.mrp = def.mrp;
    this.unit = def.label.en;
  }
  this.stock = variants.filter((v) => v.isActive).reduce((sum, v) => sum + v.stock, 0);
  next();
});

// Search
productSchema.index({ 'title.en': 'text', 'title.hi': 'text', tags: 'text' });

// Common catalog filter/sort combinations
productSchema.index({ category: 1, price: 1 });
productSchema.index({ category: 1, ratingAvg: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });

toJSONPlugin(productSchema);

export const Product = mongoose.model('Product', productSchema);
