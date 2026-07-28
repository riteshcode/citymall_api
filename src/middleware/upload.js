import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Only jpeg, png, webp or avif images are allowed'));
  }
  cb(null, true);
}

/** In-memory multer instance; controllers push the buffer to S3 via utils/s3.js. */
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
});
