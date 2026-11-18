import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as pushController from '../controllers/push.controller.js';
import { pushSubscriptionSchema, removePushSubscriptionSchema } from '../validations/push.validation.js';

const router = Router();

// Mounted at the API root, so authenticate is applied per route (a router-level guard would capture later public routes).
router.get('/push/vapid-public-key', pushController.getVapidPublicKey);
router.post('/me/push-subscriptions', authenticate, validate(pushSubscriptionSchema), pushController.subscribe);
router.delete('/me/push-subscriptions', authenticate, validate(removePushSubscriptionSchema), pushController.unsubscribe);

export default router;
