import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import * as settingsService from '../services/settings.service.js';

/** Public: lets the customer app show "add ₹X more for free delivery" and store open/closed state. */
export const getPublicSettings = catchAsync(async (req, res) => {
  const doc = await settingsService.getSettings();
  sendSuccess(res, { data: settingsService.serializeSettings(doc) });
});

export const getAdminSettings = catchAsync(async (req, res) => {
  const doc = await settingsService.getSettings();
  sendSuccess(res, { data: { ...settingsService.serializeSettings(doc), updatedAt: doc.updatedAt } });
});

export const updateAdminSettings = catchAsync(async (req, res) => {
  const doc = await settingsService.updateSettings(req.body);
  sendSuccess(res, { data: { ...settingsService.serializeSettings(doc), updatedAt: doc.updatedAt } });
});
