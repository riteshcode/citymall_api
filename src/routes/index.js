import { Router } from 'express';
import authRoutes from './auth.routes.js';
import catalogRoutes from './catalog.routes.js';
import cartRoutes from './cart.routes.js';
import addressRoutes from './address.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import adminRoutes from './admin.routes.js';
import wishlistRoutes from './wishlist.routes.js';
import settingsRoutes from './settings.routes.js';
import riderRoutes from './rider.routes.js';
import pushRoutes from './push.routes.js';
import geoRoutes from './geo.routes.js';
import couponRoutes from './coupon.routes.js';

const router = Router();

router.use(authRoutes);
router.use(catalogRoutes);
router.use(addressRoutes);
router.use(pushRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/settings', settingsRoutes);
router.use('/rider', riderRoutes);
router.use('/geo', geoRoutes);
router.use('/coupons', couponRoutes);

export default router;
