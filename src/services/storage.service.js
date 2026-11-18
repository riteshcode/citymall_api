import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * Image storage behind one interface, selected by STORAGE_PROVIDER (cloudinary | s3):
 *   upload(file: { buffer, mimetype, originalname }) -> Promise<{ url, ref }>   // ref = what remove() needs
 *   remove(ref) -> Promise<void>
 * Providers always throw ApiError (UPLOAD_FAILED), never raw SDK errors.
 */

export const CLOUDINARY_FOLDER = 'aali-market/products';

/**
 * Applied to the uploaded ORIGINAL before it is stored: caps big camera photos at 1000x1000 (never upscales)
 * and recompresses with q_auto.
 * NOT f_auto: Cloudinary documents that f_auto must never be used in an incoming transformation (the format is
 * negotiated per request at the CDN, so it only works in a delivery URL). It is added to the returned URL below.
 */
const INCOMING_TRANSFORMATION = [
  { width: 1000, height: 1000, crop: 'limit' },
  { quality: 'auto' },
];

/** Added to the URL we hand out, so browsers automatically get WebP/AVIF at an appropriate quality. */
const DELIVERY_OPTIONS = { fetch_format: 'auto', quality: 'auto' };

// ---------------------------------------------------------------- cloudinary

function cloudinaryConfigured() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  return Boolean(cloudName && apiKey && apiSecret);
}

function configureCloudinary() {
  if (!cloudinaryConfigured()) {
    throw new ApiError(503, ErrorCodes.UPLOAD_FAILED, 'Image uploads are not configured on the server');
  }
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
}

/** Cloudinary rejects the file itself (e.g. not really an image) -> 400; anything else is on our side/theirs -> 502. */
function toUploadError(err) {
  logger.error(`[Storage:cloudinary] upload failed (${err?.http_code ?? 'no status'}): ${err?.message ?? err}`);
  if (err?.http_code === 400) {
    return ApiError.badRequest(ErrorCodes.UPLOAD_FAILED, 'This file could not be processed as an image');
  }
  return new ApiError(502, ErrorCodes.UPLOAD_FAILED, 'Image upload failed, please try again');
}

const cloudinaryProvider = {
  async upload(file) {
    configureCloudinary();

    let result;
    try {
      result = await new Promise((resolve, reject) => {
        // Streams the in-memory multer buffer straight to Cloudinary — nothing touches the disk.
        const stream = cloudinary.uploader.upload_stream(
          { folder: CLOUDINARY_FOLDER, resource_type: 'image', transformation: INCOMING_TRANSFORMATION },
          (err, res) => (err || !res?.public_id ? reject(err || new Error('Empty response from Cloudinary')) : resolve(res))
        );
        stream.on('error', reject);
        stream.end(file.buffer);
      });
    } catch (err) {
      throw toUploadError(err);
    }

    // https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/v<version>/<public_id> — no extension on
    // purpose: with f_auto the CDN picks the format (AVIF/WebP/JPEG) per browser.
    const url = cloudinary.url(result.public_id, {
      secure: true,
      resource_type: 'image',
      type: result.type || 'upload',
      version: result.version,
      urlAnalytics: false, // otherwise the SDK appends a tracking suffix (?_a=...) to every URL
      ...DELIVERY_OPTIONS,
    });
    return { url, ref: result.public_id };
  },

  async remove(publicId) {
    configureCloudinary();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  },
};

// ---------------------------------------------------------------- s3 (legacy, only when STORAGE_PROVIDER=s3)

const s3Provider = {
  async upload(file) {
    // Imported lazily so the AWS SDK is never loaded (and S3 never configured) unless this provider is selected.
    const { uploadBufferToS3 } = await import('../utils/s3.js');
    try {
      const url = await uploadBufferToS3(file.buffer, {
        mimetype: file.mimetype,
        originalName: file.originalname,
        folder: 'products',
      });
      return { url, ref: url };
    } catch (err) {
      logger.error(`[Storage:s3] upload failed: ${err?.message ?? err}`);
      throw new ApiError(502, ErrorCodes.UPLOAD_FAILED, 'Image upload failed, please try again');
    }
  },

  async remove(url) {
    const { deleteFromS3 } = await import('../utils/s3.js');
    await deleteFromS3(url);
  },
};

// ---------------------------------------------------------------- public API

const providers = { cloudinary: cloudinaryProvider, s3: s3Provider };

function getProvider() {
  const provider = providers[env.storage.provider];
  if (!provider) {
    logger.error(`[Storage] unknown STORAGE_PROVIDER "${env.storage.provider}" (use "cloudinary" or "s3")`);
    throw new ApiError(503, ErrorCodes.UPLOAD_FAILED, 'Image uploads are not configured on the server');
  }
  return provider;
}

/**
 * Uploads all files in parallel and returns their URLs in the same order. All-or-nothing: if any file fails,
 * the ones that already succeeded are deleted again (best effort) so a failed request leaves no orphans behind.
 * @param {{ buffer: Buffer, mimetype: string, originalname: string }[]} files
 * @returns {Promise<string[]>}
 */
export async function uploadImages(files) {
  const provider = getProvider();
  const settled = await Promise.allSettled(files.map((file) => provider.upload(file)));

  const failure = settled.find((r) => r.status === 'rejected');
  if (!failure) return settled.map((r) => r.value.url);

  const uploaded = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  await Promise.allSettled(
    uploaded.map((u) =>
      provider.remove(u.ref).catch((err) => logger.warn(`[Storage] could not clean up ${u.ref}: ${err?.message ?? err}`))
    )
  );
  throw failure.reason;
}

/** Misconfiguration notes for startup. Logged, never thrown: the server must boot without storage credentials. */
export function storageWarnings() {
  const { provider } = env.storage;
  if (!providers[provider]) {
    return [`STORAGE_PROVIDER="${provider}" is not valid (use "cloudinary" or "s3"): POST /admin/uploads will fail with UPLOAD_FAILED.`];
  }
  if (provider === 'cloudinary' && !cloudinaryConfigured()) {
    return ['STORAGE_PROVIDER=cloudinary but CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not all set: POST /admin/uploads will fail with UPLOAD_FAILED until they are.'];
  }
  return [];
}
