import { catchAsync } from '../utils/catchAsync.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Product } from '../models/Product.js';
import { ApiError } from '../utils/ApiError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { mergeBilingualFields } from '../utils/mongoosePlugins.js';
import * as productService from '../services/product.service.js';

export const listProducts = catchAsync(async (req, res) => {
  const { docs, total, page, limit, pages } = await productService.listProducts(req.query);
  sendSuccess(res, { data: docs, meta: { total, page, limit, pages } });
});

export const suggestProducts = catchAsync(async (req, res) => {
  sendSuccess(res, { data: await productService.suggestProducts(req.query.q) });
});

export const getProductBySlug = catchAsync(async (req, res) => {
  const product = await productService.getProductBySlug(req.params.slug);
  sendSuccess(res, { data: product });
});

export const getRelatedProducts = catchAsync(async (req, res) => {
  const products = await productService.getRelatedProducts(req.params.id, req.query.limit);
  sendSuccess(res, { data: products });
});

export const createProduct = catchAsync(async (req, res) => {
  const product = await Product.create(req.body);
  sendSuccess(res, { statusCode: 201, data: product });
});

export const updateProduct = catchAsync(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');

  mergeBilingualFields(product, req.body, ['title', 'description']);
  Object.assign(product, req.body);
  await product.save();
  sendSuccess(res, { data: product });
});

export const deleteProduct = catchAsync(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!product) throw ApiError.notFound(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
  sendSuccess(res, { data: product });
});
