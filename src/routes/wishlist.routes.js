import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdSchema } from '../utils/zodHelpers.js';
import * as wishlistController from '../controllers/wishlist.controller.js';

const productIdParam = { params: z.object({ productId: objectIdSchema }).strict() };

const router = Router();
router.use(authenticate);

router.get('/', wishlistController.getWishlist);
router.post('/:productId', validate(productIdParam), wishlistController.addToWishlist);
router.delete('/:productId', validate(productIdParam), wishlistController.removeFromWishlist);

export default router;
