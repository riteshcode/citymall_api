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
import * as adminController from '../controllers/admin.controller.js';
import * as settingsController from '../controllers/settings.controller.js';
import * as pincodeController from '../controllers/pincode.controller.js';

import { createCategorySchema, updateCategorySchema, categoryIdParamSchema } from '../validations/category.validation.js';
import { createProductSchema, updateProductSchema, productIdParamSchema } from '../validations/product.validation.js';
import { createCouponSchema, updateCouponSchema, couponIdParamSchema } from '../validations/coupon.validation.js';
import { createBannerSchema, updateBannerSchema, bannerIdParamSchema } from '../validations/banner.validation.js';
import { adminListProductsSchema, adminListUsersSchema } from '../validations/admin.validation.js';
import { updateSettingsSchema } from '../validations/settings.validation.js';
import {
  listPincodesSchema,
  createPincodeSchema,
  updatePincodeSchema,
  pincodeIdParamSchema,
} from '../validations/pincode.validation.js';
import { updateOrderStatusSchema, adminListOrdersSchema, orderIdParamSchema } from '../validations/order.validation.js';

const router = Router();

// Every /admin/* route requires an authenticated admin.
router.use(authenticate, requireRole('admin'));

// Dashboard + customers
router.get('/stats', adminController.getStats);
router.get('/users', validate(adminListUsersSchema), adminController.listUsers);

// Store settings (delivery fee, free-delivery threshold, handling fee, min order, open/closed, timings)
router.get('/settings', settingsController.getAdminSettings);
router.patch('/settings', validate(updateSettingsSchema), settingsController.updateAdminSettings);

// Serviceable areas
router.get('/pincodes', validate(listPincodesSchema), pincodeController.listPincodes);
router.post('/pincodes', validate(createPincodeSchema), pincodeController.createPincode);
router.patch('/pincodes/:id', validate(updatePincodeSchema), pincodeController.updatePincode);
router.delete('/pincodes/:id', validate(pincodeIdParamSchema), pincodeController.deletePincode);

// Products
router.get('/products', validate(adminListProductsSchema), adminController.listProducts);
router.post('/products', validate(createProductSchema), productController.createProduct);
router.patch('/products/:id', validate(updateProductSchema), productController.updateProduct);
router.delete('/products/:id', validate(productIdParamSchema), productController.deleteProduct);

// Categories
router.get('/categories', categoryController.adminListCategories);
router.post('/categories', validate(createCategorySchema), categoryController.createCategory);
router.patch('/categories/:id', validate(updateCategorySchema), categoryController.updateCategory);
router.delete('/categories/:id', validate(categoryIdParamSchema), categoryController.deleteCategory);

// Coupons
router.get('/coupons', couponController.listCoupons);
router.post('/coupons', validate(createCouponSchema), couponController.createCoupon);
router.patch('/coupons/:id', validate(updateCouponSchema), couponController.updateCoupon);
router.delete('/coupons/:id', validate(couponIdParamSchema), couponController.deleteCoupon);

// Banners
router.get('/banners', bannerController.adminListBanners);
router.post('/banners', validate(createBannerSchema), bannerController.createBanner);
router.patch('/banners/:id', validate(updateBannerSchema), bannerController.updateBanner);
router.delete('/banners/:id', validate(bannerIdParamSchema), bannerController.deleteBanner);

// Orders
router.get('/orders', validate(adminListOrdersSchema), orderController.adminListOrders);
router.get('/orders/:id', validate(orderIdParamSchema), orderController.adminGetOrder);
router.patch('/orders/:id/status', validate(updateOrderStatusSchema), orderController.adminUpdateOrderStatus);

// Media uploads (product/category/banner images)
router.post('/uploads', upload.array('images', 6), uploadController.uploadImages);

export default router;
