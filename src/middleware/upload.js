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

// ---------------------------------------------------------------- CSV (product import)

export const MAX_CSV_BYTES = 2 * 1024 * 1024;

// Excel on Windows labels CSVs application/vnd.ms-excel; some clients send octet-stream. The extension must be .csv either way.
const CSV_MIME = new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream']);

const csvMulter = multer({
  storage,
  fileFilter(req, file, cb) {
    if (!/\.csv$/i.test(file.originalname) || !CSV_MIME.has(file.mimetype)) {
      return cb(ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Upload a .csv file'));
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_CSV_BYTES + 1, files: 1 },
});

/** Accepts ONE csv in the multipart field "file" (kept in memory) with errors worded for CSVs, not images. */
export const uploadCsv = (req, res, next) => {
  csvMulter.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.name !== 'MulterError') return next(err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(413, ErrorCodes.FILE_TOO_LARGE, `The CSV must be ${MAX_CSV_BYTES / 1024 / 1024} MB or smaller`));
    }
    return next(ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'Send exactly one CSV in the multipart field "file"'));
  });
};
