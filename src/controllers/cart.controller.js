import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as cartService from '../services/cart.service.js';

export const getCart = catchAsync(async (req, res) => {
  const cart = await cartService.getCart(req.user.id, { pincode: req.query.pincode });
  sendSuccess(res, { data: cart });
});

export const addItem = catchAsync(async (req, res) => {
  const cart = await cartService.addItem(req.user.id, req.body.productId, req.body.variantId, req.body.qty);
  sendSuccess(res, { statusCode: 201, data: cart });
});

export const updateItem = catchAsync(async (req, res) => {
  const cart = await cartService.updateItemQty(req.user.id, req.params.productId, req.query.variantId, req.body.qty);
  sendSuccess(res, { data: cart });
});

export const removeItem = catchAsync(async (req, res) => {
  const cart = await cartService.removeItem(req.user.id, req.params.productId, req.query.variantId);
  sendSuccess(res, { data: cart });
});

export const clearCart = catchAsync(async (req, res) => {
  const cart = await cartService.clearCart(req.user.id);
  sendSuccess(res, { data: cart });
});

export const applyCoupon = catchAsync(async (req, res) => {
  const cart = await cartService.applyCoupon(req.user.id, req.body.code);
  sendSuccess(res, { data: cart });
});

export const removeCoupon = catchAsync(async (req, res) => {
  const cart = await cartService.removeCoupon(req.user.id);
  sendSuccess(res, { data: cart });
});
