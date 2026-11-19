import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Wishlist } from '../models/Wishlist.js';
import { publicProductJSON } from '../utils/variants.js';

async function getOrCreateWishlist(userId) {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, products: [] });
  return wishlist;
}

export const getWishlist = catchAsync(async (req, res) => {
  const wishlist = await (await getOrCreateWishlist(req.user.id)).populate('products');
  const json = wishlist.toJSON();
  json.products = wishlist.products.map(publicProductJSON); // customers never see a switched-off variant
  sendSuccess(res, { data: json });
});

export const addToWishlist = catchAsync(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user.id);
  if (!wishlist.products.some((p) => p.toString() === req.params.productId)) {
    wishlist.products.push(req.params.productId);
    await wishlist.save();
  }
  sendSuccess(res, { statusCode: 201, data: wishlist });
});

export const removeFromWishlist = catchAsync(async (req, res) => {
  const wishlist = await getOrCreateWishlist(req.user.id);
  wishlist.products = wishlist.products.filter((p) => p.toString() !== req.params.productId);
  await wishlist.save();
  sendSuccess(res, { data: wishlist });
});
