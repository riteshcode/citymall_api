import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import * as riderController from '../controllers/rider.controller.js';
import { riderOrdersSchema, riderOrderIdSchema, deliverOrderSchema } from '../validations/rider.validation.js';

const router = Router();

// Everything under /rider/* is for delivery riders only (they sign in with the normal OTP flow).
router.use(authenticate, requireRole('rider'));

router.get('/orders', validate(riderOrdersSchema), riderController.listMyOrders);
router.patch('/orders/:id/out-for-delivery', validate(riderOrderIdSchema), riderController.markOutForDelivery);
router.post('/orders/:id/deliver', validate(deliverOrderSchema), riderController.deliverOrder);

export default router;
