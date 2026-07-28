import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { uploadBufferToS3 } from '../utils/s3.js';

/** Admin-only: uploads one or more images (product/category/banner) to S3-compatible storage, returns their URLs. */
export const uploadImages = catchAsync(async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'At least one image file is required (field name "images")');
  }

  const urls = await Promise.all(
    files.map((file) =>
      uploadBufferToS3(file.buffer, {
        mimetype: file.mimetype,
        originalName: file.originalname,
        folder: 'products',
      })
    )
  );

  sendSuccess(res, { statusCode: 201, data: { urls } });
});
