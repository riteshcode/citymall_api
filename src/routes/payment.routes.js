import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { verifyPaymentSchema } from '../validations/payment.validation.js';

const router = Router();

// NOTE: raw body parsing for this route is configured in app.js (must run
// before express.json() so the signature can be verified against raw bytes).
router.post('/webhook', paymentController.handleWebhook);

router.post('/verify', authenticate, validate(verifyPaymentSchema), paymentController.verifyPayment);

export default router;
