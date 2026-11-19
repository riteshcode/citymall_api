import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { geoLimiter } from '../middleware/rateLimit.js';
import * as geoController from '../controllers/geo.controller.js';
import { reverseGeocodeSchema } from '../validations/geo.validation.js';

const router = Router();

// Public (no login needed to see "Delivering to ..."), so it has its own per-IP limit.
router.get('/reverse', geoLimiter, validate(reverseGeocodeSchema), geoController.reverse);

export default router;
