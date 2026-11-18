import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as reportService from '../services/report.service.js';

export const sales = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await reportService.salesReport(req.query) });
});

export const topProducts = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await reportService.topProductsReport(req.query) });
});

export const cod = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await reportService.codReport(req.query) });
});
