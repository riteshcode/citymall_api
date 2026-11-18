import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as addressController from '../controllers/address.controller.js';
import {
  createAddressSchema,
  updateAddressSchema,
  addressIdParamSchema,
  serviceabilitySchema,
} from '../validations/address.validation.js';

const router = Router();

router.get('/serviceability', validate(serviceabilitySchema), addressController.checkServiceability);

// authenticate is applied per route, NOT with router.use(): this router is mounted at the API root, so a
// router-level guard would also demand a token for every public route mounted after it (/settings,
// /payments/webhook, ...) and answer 401 instead of reaching them.
router.get('/addresses', authenticate, addressController.listAddresses);
router.post('/addresses', authenticate, validate(createAddressSchema), addressController.createAddress);
router.patch('/addresses/:id', authenticate, validate(updateAddressSchema), addressController.updateAddress);
router.delete('/addresses/:id', authenticate, validate(addressIdParamSchema), addressController.deleteAddress);
router.post('/addresses/:id/default', authenticate, validate(addressIdParamSchema), addressController.setDefaultAddress);

export default router;
