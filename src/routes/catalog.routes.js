import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import * as categoryController from '../controllers/category.controller.js';
import * as productController from '../controllers/product.controller.js';
import * as bannerController from '../controllers/banner.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import { authenticate } from '../middleware/auth.js';
import {
  listProductsSchema,
  productSlugParamSchema,
  productIdParamSchema,
  relatedProductsSchema,
  suggestProductsSchema,
} from '../validations/product.validation.js';
import { createReviewSchema, listReviewsSchema, myReviewSchema } from '../validations/review.validation.js';

const router = Router();

router.get('/categories', categoryController.listCategories);
router.get('/banners', bannerController.listBanners);

router.get('/products', validate(listProductsSchema), productController.listProducts);
// Must be registered before '/products/:slug', which would otherwise swallow "suggest" as a slug.
router.get('/products/suggest', validate(suggestProductsSchema), productController.suggestProducts);
router.get('/products/:slug', validate(productSlugParamSchema), productController.getProductBySlug);
router.get('/products/:id/related', validate(relatedProductsSchema), productController.getRelatedProducts);

router.get('/products/:id/reviews', validate(listReviewsSchema), reviewController.listReviews);
router.get('/products/:id/reviews/mine', authenticate, validate(myReviewSchema), reviewController.getMyReview);
router.post('/products/:id/reviews', authenticate, validate(createReviewSchema), reviewController.createReview);

export default router;
