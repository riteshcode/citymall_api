import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { uploadImages as storeImages } from '../services/storage.service.js';

/**
 * Admin-only: uploads 1-6 images (product/category/banner) to the configured storage provider.
 * Contract: 201 { success, data: { urls: [https URL, ...] }, error: null } — urls are in the same order as the files.
 */
export const uploadImages = catchAsync(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'At least one image file is required (field name "images")');
  }

  const urls = await storeImages(files);
  sendSuccess(res, { statusCode: 201, data: { urls } });
});
