import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { Pincode } from '../models/Pincode.js';
import { containsRegex } from '../utils/regex.js';
import { mergeBilingualFields, paginateQuery } from '../utils/mongoosePlugins.js';

export const listPincodes = catchAsync(async (req, res) => {
  const { page, limit, q, isActive } = req.query;
  const filter = {};
  if (isActive !== undefined) filter.isActive = isActive;
  if (q) {
    const rx = containsRegex(q);
    filter.$or = [{ pincode: rx }, { 'areaName.en': rx }, { 'areaName.hi': rx }];
  }
  const { docs, total, pages } = await paginateQuery(Pincode, filter, { page, limit, sort: { pincode: 1 } });
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const createPincode = catchAsync(async (req, res) => {
  // A duplicate pincode surfaces as 409 DUPLICATE_KEY via the central error handler.
  const doc = await Pincode.create(req.body);
  sendSuccess(res, { statusCode: 201, data: doc });
});

export const updatePincode = catchAsync(async (req, res) => {
  const doc = await Pincode.findById(req.params.id);
  if (!doc) throw ApiError.notFound(ErrorCodes.PINCODE_NOT_FOUND, 'Pincode not found');

  mergeBilingualFields(doc, req.body, ['areaName']);
  Object.assign(doc, req.body);
  await doc.save();
  sendSuccess(res, { data: doc });
});

/** Hard delete (unlike products/categories): a pincode is pure config and nothing references it — orders snapshot the address. */
export const deletePincode = catchAsync(async (req, res) => {
  const doc = await Pincode.findByIdAndDelete(req.params.id);
  if (!doc) throw ApiError.notFound(ErrorCodes.PINCODE_NOT_FOUND, 'Pincode not found');
  sendSuccess(res, { data: { message: 'Pincode deleted' } });
});
