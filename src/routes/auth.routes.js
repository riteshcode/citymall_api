import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { otpSendLimiter, authLimiter } from '../middleware/rateLimit.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
  updateMeSchema,
} from '../validations/auth.validation.js';

const router = Router();

router.post('/auth/otp/send', otpSendLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post('/auth/otp/verify', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/auth/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);

router.get('/me', authenticate, authController.getMe);
router.patch('/me', authenticate, validate(updateMeSchema), authController.updateMe);

export default router;
