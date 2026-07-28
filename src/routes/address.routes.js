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

router.use(authenticate);
router.get('/addresses', addressController.listAddresses);
router.post('/addresses', validate(createAddressSchema), addressController.createAddress);
router.patch('/addresses/:id', validate(updateAddressSchema), addressController.updateAddress);
router.delete('/addresses/:id', validate(addressIdParamSchema), addressController.deleteAddress);
router.post('/addresses/:id/default', validate(addressIdParamSchema), addressController.setDefaultAddress);

export default router;
