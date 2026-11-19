import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { otpSendLimiter, authLimiter, staffLoginIpLimiter, staffLoginUserLimiter } from '../middleware/rateLimit.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  refreshSchema,
  logoutSchema,
  updateMeSchema,
  staffLoginSchema,
  changePasswordSchema,
} from '../validations/auth.validation.js';

const router = Router();

router.post('/auth/otp/send', otpSendLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post('/auth/otp/verify', authLimiter, validate(verifyOtpSchema), authController.verifyOtp);
router.post('/auth/staff/login', staffLoginIpLimiter, staffLoginUserLimiter, validate(staffLoginSchema), authController.staffLogin);
router.post('/auth/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);

router.get('/me', authenticate, authController.getMe);
router.patch('/me/password', authenticate, requireRole('admin', 'rider'), validate(changePasswordSchema), authController.changePassword);
router.patch('/me', authenticate, validate(updateMeSchema), authController.updateMe);

export default router;
