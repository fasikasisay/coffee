const Product        = require('../models/Product');
const Stock          = require('../models/Stock');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { body, validationResult } = require('express-validator');

const VALID_CATEGORIES = ['green-beans', 'roasted', 'specialty', 'blend'];

// ── Validation middlewar
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
  body('lowStockThreshold').optional().isInt({ min: 0 })
    .withMessage('lowStockThreshold must be a non-negative integer'),
  body('description').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 2000 }).withMessage('description must be under 2000 characters'),
  body('region').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }),
  body('process').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }),
  body('grade').optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 50 }),
];

exports.updateProductValidation = [
  body('name').optional().trim()
    .notEmpty().withMessage('Product name cannot be empty')
    .isLength({ max: 255 }).withMessage('Product name must be under 255 characters'),
  body('category').optional().trim().isIn(VALID_CATEGORIES)
    .withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
  body('pricePerKg').optional()
    .custom((v) => (typeof v === 'number' || typeof v === 'string') &&
                   /^\d{1,7}(\.\d{1,2})?$/.test(String(v).trim()) && Number(v) > 0)
    .withMessage('Price must be greater than 0, with at most 2 decimals (maximum 9,999,999.99)'),
  body('minOrderKg').optional().isInt({ min: 1 }),
  body('stock').optional().isInt({ min: 0 }),
  body('lowStockThreshold').optional().isInt({ min: 0 }),
  body('description').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('region').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('process').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 100 }),
  body('grade').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 50 }),
 body('image').optional().isString().isLength({ max: 255 }).withMessage('image path must be under 255 characters'),
body('isAvailable').optional().isBoolean() .withMessage('isAvailable must be true or false'),
];


// GET /api/v1/products
exports.getProducts = asyncHandler(async (req, res) => {
  const onlyAvailable = req.query.available === 'true';
  const products = await Product.findAll({ onlyAvailable });
  res.set('Cache-Control', 'no-cache');   // name/price edits must show up on the next load
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
  res.set('Cache-Control', 'no-cache');
  res.status(200).json({ success: true, data: product });
});

// POST /api/v1/products  (admin)
exports.createProduct = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const productData = {
    ...req.body,
  };

  // Save uploaded image path
  if (req.file) {
    productData.image = `/uploads/products/${req.file.filename}`;
  }

  const product = await Product.create(productData, req.admin?.id);

  res.status(201).json({
    success: true,
    data: product,
  });
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

  // Stock changes always go through the stock ledger so history stays accurate
  const { stock, ...fields } = req.body;
  if (stock !== undefined && Number(stock) !== product.stock) {
    await Stock.withTransaction((conn) => Stock.setTo(conn, id, Number(stock), {
      type: 'adjustment', reason: 'Stock edited via product update', adminId: req.admin?.id,
    }));
  }

  let updated;
  try {
    updated = await Product.update(id, fields);
  } catch (err) {
    // products.slug is unique — a rename that maps to an existing product's name
    if (err.code === 'ER_DUP_ENTRY') {
      return next(new ErrorResponse('Another product already uses this name. Please choose a different name.', 409));
    }
    throw err;
  }
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
