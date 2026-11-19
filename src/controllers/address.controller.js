import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { resolveDelivery } from '../services/serviceability.service.js';
import { getSettings } from '../services/settings.service.js';

function findAddress(user, id) {
  const address = user.addresses.find((a) => a._id.toString() === id);
  if (!address) throw ApiError.notFound(ErrorCodes.ADDRESS_NOT_FOUND, 'Address not found');
  return address;
}

export const listAddresses = catchAsync(async (req, res) => {
  sendSuccess(res, { data: req.userDoc.addresses });
});

export const createAddress = catchAsync(async (req, res) => {
  const user = req.userDoc;
  if (req.body.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => (a.isDefault = false));
    req.body.isDefault = true;
  }
  user.addresses.push(req.body);
  await user.save();
  sendSuccess(res, { statusCode: 201, data: user.addresses.at(-1) });
});

export const updateAddress = catchAsync(async (req, res) => {
  const user = req.userDoc;
  const address = findAddress(user, req.params.id);

  if (req.body.isDefault) {
    user.addresses.forEach((a) => (a.isDefault = false));
  }
  // location: null clears the pin; the field is then absent, exactly like an address that never had one.
  if (req.body.location === null) {
    address.set('location', undefined);
    delete req.body.location;
  }
  Object.assign(address, req.body);
  await user.save();
  sendSuccess(res, { data: address });
});

export const deleteAddress = catchAsync(async (req, res) => {
  const user = req.userDoc;
  const address = findAddress(user, req.params.id);
  const wasDefault = address.isDefault;
  user.addresses.pull({ _id: req.params.id });
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }
  await user.save();
  sendSuccess(res, { data: { message: 'Address deleted' } });
});

export const setDefaultAddress = catchAsync(async (req, res) => {
  const user = req.userDoc;
  const address = findAddress(user, req.params.id);
  user.addresses.forEach((a) => (a.isDefault = false));
  address.isDefault = true;
  await user.save();
  sendSuccess(res, { data: user.addresses });
});

/** Reads the Pincode collection (see serviceability.service.js for the "nothing configured yet" open mode). */
export const checkServiceability = catchAsync(async (req, res) => {
  const { pincode } = req.query;
  const delivery = await resolveDelivery(pincode);
  const settings = delivery.serviceable ? await getSettings() : null;

  sendSuccess(res, {
    data: {
      pincode,
      serviceable: delivery.serviceable,
      etaDays: delivery.etaDays,
      etaMinutes: delivery.etaMinutes, // set for quick-delivery areas ("30 minutes"), else null
      areaName: delivery.areaName,
      // Base delivery fee (paise) for this pincode, before the free-delivery threshold is applied.
      deliveryFee: settings ? delivery.deliveryFeeOverride ?? settings.deliveryFee : null,
    },
  });
});
