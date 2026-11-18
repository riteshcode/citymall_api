import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Category } from '../models/Category.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { mergeBilingualFields } from '../utils/mongoosePlugins.js';

export const listCategories = catchAsync(async (req, res) => {
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
  sendSuccess(res, { data: categories });
});

/** Admin: every category, inactive ones included. */
export const adminListCategories = catchAsync(async (req, res) => {
  const categories = await Category.find().sort({ sortOrder: 1, createdAt: 1 });
  sendSuccess(res, { data: categories });
});

export const createCategory = catchAsync(async (req, res) => {
  const category = await Category.create(req.body);
  sendSuccess(res, { statusCode: 201, data: category });
});

export const updateCategory = catchAsync(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw ApiError.notFound(ErrorCodes.CATEGORY_NOT_FOUND, 'Category not found');

  mergeBilingualFields(category, req.body, ['name']);
  Object.assign(category, req.body);
  await category.save();
  sendSuccess(res, { data: category });
});

export const deleteCategory = catchAsync(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) throw ApiError.notFound(ErrorCodes.CATEGORY_NOT_FOUND, 'Category not found');
  sendSuccess(res, { data: category });
});
