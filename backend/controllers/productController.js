const Product        = require('../models/Product');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { body, validationResult } = require('express-validator');

const VALID_CATEGORIES = ['green-beans', 'roasted', 'specialty', 'blend'];

// ── Validation middleware
exports.createProductValidation = [
  body('name').trim().notEmpty().withMessage('name is required')
    .isLength({ max: 255 }).withMessage('name must be under 255 characters'),
  body('category').trim().isIn(VALID_CATEGORIES)
    .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
  body('pricePerKg').isFloat({ min: 0.01 })
    .withMessage('pricePerKg must be a positive number'),
  body('minOrderKg').optional().isInt({ min: 1 })
    .withMessage('minOrderKg must be a positive integer'),
  body('stock').optional().isInt({ min: 0 })
    .withMessage('stock must be a non-negative integer'),
  body('description').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 2000 }).withMessage('description must be under 2000 characters'),
  body('region').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }),
  body('process').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }),
  body('grade').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 50 }),
  body('image').optional({ nullable: true, checkFalsy: true })
    .trim().isURL().withMessage('image must be a valid URL')
    .isLength({ max: 500 }),
];

exports.updateProductValidation = [
  body('name').optional().trim().notEmpty().isLength({ max: 255 }),
  body('category').optional().trim().isIn(VALID_CATEGORIES)
    .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
  body('pricePerKg').optional().isFloat({ min: 0.01 })
    .withMessage('pricePerKg must be a positive number'),
  body('minOrderKg').optional().isInt({ min: 1 }),
  body('stock').optional().isInt({ min: 0 }),
  body('description').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('region').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('process').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('grade').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
  body('image').optional({ nullable: true, checkFalsy: true }).trim().isURL().isLength({ max: 500 }),
  body('isAvailable').optional().isBoolean(),
];


// GET /api/v1/products
exports.getProducts = asyncHandler(async (req, res) => {
  const onlyAvailable = req.query.available === 'true';
  const products = await Product.findAll({ onlyAvailable });
  res.status(200).json({ success: true, count: products.length, data: products });
});

// GET /api/v1/products/:id
exports.getProduct = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid product ID', 400));
  }
  const product = await Product.findById(id);
  if (!product) return next(new ErrorResponse('Product not found', 404));
  res.status(200).json({ success: true, data: product });
});

// POST /api/v1/products  (admin)
exports.createProduct = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }
  const product = await Product.create(req.body);
  res.status(201).json({ success: true, data: product });
});

// PUT /api/v1/products/:id  (admin)
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid product ID', 400));
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const product = await Product.findById(id);
  if (!product) return next(new ErrorResponse('Product not found', 404));

  const updated = await Product.update(id, req.body);
  res.status(200).json({ success: true, data: updated });
});

// DELETE /api/v1/products/:id  (superadmin only — enforced in route)
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid product ID', 400));
  }
  const deleted = await Product.delete(id);
  if (!deleted) return next(new ErrorResponse('Product not found', 404));
  res.status(200).json({ success: true, data: {} });
});
