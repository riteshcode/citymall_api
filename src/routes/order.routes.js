import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as orderController from '../controllers/order.controller.js';
import {
  createOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  cancelOrderSchema,
} from '../validations/order.validation.js';

const router = Router();
router.use(authenticate);

router.post('/', validate(createOrderSchema), orderController.createOrder);
router.get('/', validate(listOrdersSchema), orderController.listOrders);
router.get('/:id', validate(orderIdParamSchema), orderController.getOrder);
router.post('/:id/cancel', validate(cancelOrderSchema), orderController.cancelOrder);

export default router;
