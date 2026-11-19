import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { User } from '../models/User.js';
import { Pincode } from '../models/Pincode.js';
import { getSettings } from '../services/settings.service.js';
import { setPassword } from '../services/staff-auth.service.js';
import { assertSeedAdminConfig } from './admin-config.js';
import { categories as categoryFixtures, productRows } from './data.js';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seedCategories() {
  const bySlug = new Map();
  for (const fixture of categoryFixtures) {
    const category = await Category.findOneAndUpdate(
      { slug: fixture.slug },
      { ...fixture, isActive: true },
      { upsert: true, new: true, setDefaultOptions: true }
    );
    bySlug.set(category.slug, category);
  }
  logger.info(`Seeded ${bySlug.size} categories`);
  return bySlug;
}

async function seedProducts(categoriesBySlug) {
  let count = 0;
  for (const [categorySlug, titleEn, titleHi, brand, unit, mrp, price, stock, tags] of productRows) {
    const category = categoriesBySlug.get(categorySlug);
    if (!category) {
      logger.warn(`Skipping product "${titleEn}" — unknown category slug "${categorySlug}"`);
      continue;
    }

    const slug = slugify(titleEn);
    await Product.findOneAndUpdate(
      { slug },
      {
        slug,
        title: { en: titleEn, hi: titleHi },
        description: {
          en: `${titleEn} — ${unit}, sourced fresh for Aali Market customers.`,
          hi: `${titleHi} — ${unit}, आली मार्केट के ग्राहकों के लिए ताज़ा उपलब्ध।`,
        },
        category: category._id,
        brand,
        images: [],
        mrp,
        price,
        unit,
        stock,
        tags,
        isActive: true,
      },
      { upsert: true, new: true }
    );
    count += 1;
  }
  logger.info(`Seeded ${count} products`);
}

async function seedCoupon() {
  const now = new Date();
  const expiresAt = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  await Coupon.findOneAndUpdate(
    { code: 'AALI50' },
    {
      code: 'AALI50',
      type: 'flat',
      value: 5000, // ₹50 off, in paise
      minOrderValue: 19900, // ₹199 minimum order
      maxDiscount: null,
      startsAt: now,
      expiresAt,
      usageLimit: 10000,
      perUserLimit: 1,
      isActive: true,
    },
    { upsert: true, new: true }
  );
  logger.info('Seeded coupon AALI50');
}

async function seedAdmin() {
  const { adminUsername, adminPassword, adminMobile } = env.seed;
  const admin = await User.findOneAndUpdate(
    { mobile: adminMobile },
    {
      mobile: adminMobile,
      name: env.seed.adminName,
      email: env.seed.adminEmail,
      role: 'admin',
      isVerified: true,
      username: adminUsername,
    },
    { upsert: true, new: true }
  ).select('+passwordHash');

  // The seed never overwrites an existing password (re-running it must not undo a changed one): use
  // `npm run admin:set-password -- <username>` to change it.
  if (admin.passwordHash) {
    logger.info(`Seeded admin "${adminUsername}" (${adminMobile}); its existing password was left unchanged`);
  } else if (adminPassword) {
    await setPassword(admin, adminPassword);
    logger.info(`Seeded admin "${adminUsername}" (${adminMobile}) with the password from SEED_ADMIN_PASSWORD`);
  } else {
    logger.warn(`Seeded admin "${adminUsername}" WITHOUT a password: run  npm run admin:set-password -- ${adminUsername}`);
  }
}

// Starter delivery areas. NOTE: once ANY pincode exists, only active listed pincodes are serviceable
// (with none configured the API serves every pincode). Manage them via /admin/pincodes.
const pincodeFixtures = [
  { pincode: '261001', areaName: { en: 'Sitapur', hi: 'सीतापुर' }, etaDays: 1 },
  { pincode: '226001', areaName: { en: 'Lucknow - Hazratganj', hi: 'लखनऊ - हज़रतगंज' }, etaDays: 2 },
  { pincode: '110001', areaName: { en: 'New Delhi - Connaught Place', hi: 'नई दिल्ली - कनॉट प्लेस' }, etaDays: 2, deliveryFee: 3500 },
];

async function seedSettingsAndPincodes() {
  await getSettings(); // creates the singleton from env defaults if missing; never overwrites admin edits
  for (const fixture of pincodeFixtures) {
    // $setOnInsert: re-running the seed must not undo an admin's changes to an existing pincode.
    await Pincode.updateOne({ pincode: fixture.pincode }, { $setOnInsert: { isActive: true, deliveryFee: null, ...fixture } }, { upsert: true });
  }
  logger.info(`Seeded store settings and ${pincodeFixtures.length} pincodes`);
}

async function run() {
  assertSeedAdminConfig();
  await connectDB();
  logger.info('Starting seed...');

  const categoriesBySlug = await seedCategories();
  await seedProducts(categoriesBySlug);
  await seedCoupon();
  await seedAdmin();
  await seedSettingsAndPincodes();

  logger.info('Seed complete.');
  await disconnectDB();
  process.exit(0);
}

run().catch(async (err) => {
  logger.error(`Seed failed: ${err.message}`, { stack: err.stack });
  await disconnectDB().catch(() => {});
  process.exit(1);
});
