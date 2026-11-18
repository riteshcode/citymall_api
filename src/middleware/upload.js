import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 6;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Only jpeg, png, webp or avif images are allowed'));
  }
  cb(null, true);
}

/** In-memory multer instance (no temp files on disk); services/storage.service.js streams the buffers to the storage provider. */
export const upload = multer({
  storage,
  fileFilter,
  // busboy flags a file as too large when it REACHES `fileSize`, so +1 makes "max 5 MB" inclusive (a 5 MB file passes).
  limits: { fileSize: MAX_IMAGE_BYTES + 1, files: MAX_IMAGES },
});
