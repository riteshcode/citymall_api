import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Banner } from '../models/Banner.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { mergeBilingualFields } from '../utils/mongoosePlugins.js';

export const listBanners = catchAsync(async (req, res) => {
  const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1 });
  sendSuccess(res, { data: banners });
});

export const createBanner = catchAsync(async (req, res) => {
  const banner = await Banner.create(req.body);
  sendSuccess(res, { statusCode: 201, data: banner });
});

export const updateBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findById(req.params.id);
  if (!banner) throw ApiError.notFound(ErrorCodes.NOT_FOUND, 'Banner not found');

  mergeBilingualFields(banner, req.body, ['title']);
  Object.assign(banner, req.body);
  await banner.save();
  sendSuccess(res, { data: banner });
});

export const deleteBanner = catchAsync(async (req, res) => {
  const banner = await Banner.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!banner) throw ApiError.notFound(ErrorCodes.NOT_FOUND, 'Banner not found');
  sendSuccess(res, { data: banner });
});
