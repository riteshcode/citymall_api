import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

import * as categoryController from '../controllers/category.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as couponController from '../controllers/coupon.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as orderController from '../controllers/order.controller.js';
import * as uploadController from '../controllers/upload.controller.js';

import { createCategorySchema, updateCategorySchema, categoryIdParamSchema } from '../validations/category.validation.js';
import { createProductSchema, updateProductSchema, productIdParamSchema } from '../validations/product.validation.js';
import { createCouponSchema, updateCouponSchema, couponIdParamSchema } from '../validations/coupon.validation.js';
import { createBannerSchema, updateBannerSchema, bannerIdParamSchema } from '../validations/banner.validation.js';
import { updateOrderStatusSchema } from '../validations/order.validation.js';

const router = Router();

// Every /admin/* route requires an authenticated admin.
router.use(authenticate, requireRole('admin'));

// Products
router.post('/products', validate(createProductSchema), productController.createProduct);
router.patch('/products/:id', validate(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', validate(productIdParamSchema), productController.deleteProduct);

// Categories
router.post('/categories', validate(createCategorySchema), categoryController.createCategory);
router.patch('/categories/:id', validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/categories/:id', validate(categoryIdParamSchema), categoryController.deleteCategory);

// Coupons
router.get('/coupons', couponController.listCoupons);
router.post('/coupons', validate(createCouponSchema), couponController.createCoupon);
router.patch('/coupons/:id', validate(updateCouponSchema), couponController.updateCoupon);
router.delete('/coupons/:id', validate(couponIdParamSchema), couponController.deleteCoupon);

// Banners
router.post('/banners', validate(createBannerSchema), bannerController.createBanner);
router.patch('/banners/:id', validate(updateBannerSchema), bannerController.updateBanner);
router.delete('/banners/:id', validate(bannerIdParamSchema), bannerController.deleteBanner);

// Orders
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), orderController.adminUpdateOrderStatus);

// Media uploads (product/category/banner images)
router.post('/uploads', upload.array('images', 6), uploadController.uploadImages);

export default router;
