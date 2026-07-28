import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Coupon } from '../models/Coupon.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

export const listCoupons = catchAsync(async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  sendSuccess(res, { data: coupons });
});

export const createCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.create(req.body);
  sendSuccess(res, { statusCode: 201, data: coupon });
});

export const updateCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!coupon) throw ApiError.notFound(ErrorCodes.COUPON_NOT_FOUND, 'Coupon not found');
  sendSuccess(res, { data: coupon });
});

export const deleteCoupon = catchAsync(async (req, res) => {
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!coupon) throw ApiError.notFound(ErrorCodes.COUPON_NOT_FOUND, 'Coupon not found');
  sendSuccess(res, { data: coupon });
});
