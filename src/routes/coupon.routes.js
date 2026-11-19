import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { optionalAuthenticate } from '../middleware/auth.js';
import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { listAvailableCoupons } from '../services/coupon.service.js';
import { availableCouponsSchema } from '../validations/coupon.validation.js';

const router = Router();

/**
 * GET /coupons/available - public; with a token, coupons this user has already used up are left out.
 * (A request with an invalid / expired token is answered 401 so the app can refresh it, not silently treated as a guest.)
 */
router.get(
  '/available',
  optionalAuthenticate,
  validate(availableCouponsSchema),
  catchAsync(async (req, res) => {
    sendSuccess(res, { data: await listAvailableCoupons(req.user?.id ?? null) });
  })
);

export default router;
