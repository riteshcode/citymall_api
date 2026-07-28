import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

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

// Stubbed serviceability check — swap for a real pincode/hub lookup later.
const NON_SERVICEABLE_PREFIXES = ['00', '99'];

export const checkServiceability = catchAsync(async (req, res) => {
  const { pincode } = req.query;
  const serviceable = !NON_SERVICEABLE_PREFIXES.some((p) => pincode.startsWith(p));
  sendSuccess(res, {
    data: {
      pincode,
      serviceable,
      etaDays: serviceable ? 2 : null,
    },
  });
});
