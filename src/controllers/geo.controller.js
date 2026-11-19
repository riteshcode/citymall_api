import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { reverseGeocode } from '../services/geo.service.js';

/** GET /geo/reverse?lat=&lng= -> { pincode, area, city, state } */
export const reverse = catchAsync(async (req, res) => {
  const result = await reverseGeocode(req.query.lat, req.query.lng);
  res.set('Cache-Control', 'public, max-age=3600'); // the same spot gives the same answer
  sendSuccess(res, { data: result });
});
