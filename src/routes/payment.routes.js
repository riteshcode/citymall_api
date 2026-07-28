import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';

const router = Router();

// NOTE: raw body parsing for this route is configured in app.js (must run
// before express.json() so the signature can be verified against raw bytes).
router.post('/webhook', paymentController.handleWebhook);

export default router;
