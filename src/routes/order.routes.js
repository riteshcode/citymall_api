import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as orderController from '../controllers/order.controller.js';
import {
  createOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  cancelOrderSchema,
  retryPaymentSchema,
  changePaymentMethodSchema,
  reorderSchema,
} from '../validations/order.validation.js';

const router = Router();
router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.createOrder);
router.get('/', validate(listOrdersSchema), orderController.listOrders);
router.get('/:id', validate(orderIdParamSchema), orderController.getOrder);
router.post('/:id/cancel', validate(cancelOrderSchema), orderController.cancelOrder);
router.post('/:id/payment', validate(retryPaymentSchema), orderController.retryPayment);
router.patch('/:id/payment-method', validate(changePaymentMethodSchema), orderController.changePaymentMethod);
router.post('/:id/reorder', validate(reorderSchema), orderController.reorder);

export default router;
