import { connectDB, disconnectDB } from '../config/db.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Coupon } from '../models/Coupon.js';
import { User } from '../models/User.js';
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
  await User.findOneAndUpdate(
    { mobile: env.seed.adminMobile },
    {
      mobile: env.seed.adminMobile,
      name: env.seed.adminName,
      email: env.seed.adminEmail,
      role: 'admin',
      isVerified: true,
    },
    { upsert: true, new: true }
  );
  logger.info(`Seeded admin user (${env.seed.adminMobile})`);
}

async function run() {
  await connectDB();
  logger.info('Starting seed...');

  const categoriesBySlug = await seedCategories();
  await seedProducts(categoriesBySlug);
  await seedCoupon();
  await seedAdmin();

  logger.info('Seed complete.');
  await disconnectDB();
  process.exit(0);
}

run().catch(async (err) => {
  logger.error(`Seed failed: ${err.message}`, { stack: err.stack });
  await disconnectDB().catch(() => {});
  process.exit(1);
});
