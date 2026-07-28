import mongoose from 'mongoose';
import { toJSONPlugin } from '../utils/mongoosePlugins.js';

const wishlistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    products: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }], default: [] },
  },
  { timestamps: true }
);

toJSONPlugin(wishlistSchema);

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
