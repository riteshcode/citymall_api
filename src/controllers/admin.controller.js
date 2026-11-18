import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as adminService from '../services/admin.service.js';

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
