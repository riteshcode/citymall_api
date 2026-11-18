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

const router = Router();

router.use(authRoutes);
router.use(catalogRoutes);
router.use(addressRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/settings', settingsRoutes);

export default router;
