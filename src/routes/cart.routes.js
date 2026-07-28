import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as cartController from '../controllers/cart.controller.js';
import {
  addCartItemSchema,
  updateCartItemSchema,
  removeCartItemSchema,
  applyCouponSchema,
} from '../validations/cart.validation.js';

const router = Router();
router.use(authenticate);

router.get('/', cartController.getCart);
router.post('/items', validate(addCartItemSchema), cartController.addItem);
router.patch('/items/:productId', validate(updateCartItemSchema), cartController.updateItem);
router.delete('/items/:productId', validate(removeCartItemSchema), cartController.removeItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', validate(applyCouponSchema), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);

export default router;
