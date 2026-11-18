import dotenv from 'dotenv';

dotenv.config();

const toInt = (val, fallback) => {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
};

const toBool = (val, fallback) => {
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: toInt(process.env.PORT, 4000),
  apiBasePath: process.env.API_BASE_PATH || '/api/v1',

  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/aali_market',

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  otp: {
    length: toInt(process.env.OTP_LENGTH, 6),
    ttlMinutes: toInt(process.env.OTP_TTL_MINUTES, 5),
    maxAttempts: toInt(process.env.OTP_MAX_ATTEMPTS, 5),
    sendLimit: toInt(process.env.OTP_SEND_LIMIT, 3),
    sendWindowMinutes: toInt(process.env.OTP_SEND_WINDOW_MINUTES, 15),
    smsProvider: process.env.SMS_PROVIDER || 'console',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  // Number of reverse-proxy hops in front of the app (nginx / ALB / Render = 1). Needed so rate limiting
  // sees each client's real IP instead of the proxy's. Leave 0 when the app is hit directly.
  trustProxy: toInt(process.env.TRUST_PROXY, 0),

  rateLimit: {
    windowMinutes: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15),
    max: toInt(process.env.RATE_LIMIT_MAX, 300),
  },

  // Where POST /admin/uploads stores images: 'cloudinary' (default) or 's3'. Neither needs credentials to BOOT —
  // a missing config only makes uploads fail (UPLOAD_FAILED), it never crashes the server.
  storage: {
    provider: (process.env.STORAGE_PROVIDER || 'cloudinary').trim().toLowerCase(),
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },

  // Only used when STORAGE_PROVIDER=s3
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'ap-south-1',
    bucket: process.env.S3_BUCKET || 'aali-market-media',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    forcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, false),
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL,
  },

  payments: {
    provider: process.env.PAYMENT_PROVIDER || 'mock',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'dev_webhook_secret',
  },

  pricing: {
    deliveryFeePaise: toInt(process.env.DEFAULT_DELIVERY_FEE_PAISE, 2500),
    freeDeliveryThresholdPaise: toInt(process.env.FREE_DELIVERY_THRESHOLD_PAISE, 19900),
    handlingFeePaise: toInt(process.env.DEFAULT_HANDLING_FEE_PAISE, 500),
  },

  // Web Push (VAPID). Generate once with `npm run vapid:generate`. Without them push is simply disabled.
  push: {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@aalimarket.in',
    // Push-service hostnames (suffix match) accepted for subscriptions, in addition to the built-in list of
    // the browser vendors' services. Subscriptions are rejected otherwise (the server POSTs to that URL).
    extraAllowedHosts: (process.env.PUSH_EXTRA_ALLOWED_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean),
  },

  // A rider gets this many wrong delivery-OTP attempts per order before it locks (4 digits = 10,000 combinations).
  deliveryOtpMaxAttempts: toInt(process.env.DELIVERY_OTP_MAX_ATTEMPTS, 5),

  // "Today" in dashboard stats / date filters. 330 = IST (UTC+5:30, no DST).
  storeUtcOffsetMinutes: toInt(process.env.STORE_UTC_OFFSET_MINUTES, 330),

  // A product counts as "low stock" at or below this many units (admin product filter + dashboard stats).
  lowStockThreshold: toInt(process.env.LOW_STOCK_THRESHOLD, 10),

  seed: {
    adminMobile: process.env.SEED_ADMIN_MOBILE || '9999999999',
    adminName: process.env.SEED_ADMIN_NAME || 'Aali Admin',
    adminEmail: process.env.SEED_ADMIN_EMAIL || 'admin@aalimarket.in',
  },
};
