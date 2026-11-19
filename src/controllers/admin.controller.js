import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import * as adminService from '../services/admin.service.js';
import * as bulkService from '../services/product-bulk.service.js';
import * as reviewService from '../services/review.service.js';
import { formatStoreDate } from '../utils/dates.js';

export const getStats = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await adminService.getDashboardStats() });
});

export const listUsers = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await adminService.listCustomers(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const listProducts = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await adminService.listAdminProducts(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

// ---- bulk products / CSV
export const bulkUpdateProducts = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await bulkService.bulkUpdateProducts(req.body) });
});

export const exportProducts = catchAsync(async (req, res) => {
  const csv = await bulkService.exportProductsCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="products-${formatStoreDate()}.csv"`);
  res.status(200).send(csv);
});

export const importProducts = catchAsync(async (req, res) => {
  if (!req.file) {
    throw ApiError.badRequest(ErrorCodes.VALIDATION_ERROR, 'A CSV file is required (multipart field "file")');
  }
  const result = await bulkService.importProductsCsv(req.file.buffer, { dryRun: req.query.dryRun === true });
  sendSuccess(res, { data: result });
});

// ---- reviews moderation
export const listReviews = catchAsync(async (req, res) => {
  const { page, limit } = req.query;
  const { docs, total, pages } = await reviewService.listAllReviews(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const deleteReview = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await reviewService.deleteReview(req.params.id) });
});

export const moderateReview = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await reviewService.moderateReview(req.params.id, req.body) });
});
