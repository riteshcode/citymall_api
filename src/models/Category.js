import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: bilingualSchema, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    icon: { type: String, default: '' },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

categorySchema.index({ isActive: 1, sortOrder: 1 });

toJSONPlugin(categorySchema);

export const Category = mongoose.model('Category', categorySchema);
