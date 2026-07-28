import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';
import { bilingualSchema } from './shared/bilingual.js';

const bannerSchema = new mongoose.Schema(
  {
    title: { type: bilingualSchema, required: true },
    image: { type: String, required: true },
    // Deep link target inside the app, e.g. "/products/atta-5kg" or "/category/dairy"
    link: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bannerSchema.index({ isActive: 1, sortOrder: 1 });

toJSONPlugin(bannerSchema);

export const Banner = mongoose.model('Banner', bannerSchema);
