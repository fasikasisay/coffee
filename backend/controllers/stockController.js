const Stock          = require('../models/Stock');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { parseRange, parsePaging } = require('../utils/dateRange');
const { body, param, validationResult } = require('express-validator');

const MOVEMENT_TYPES = ['initial', 'restock', 'adjustment', 'sale', 'order', 'order_cancel', 'sale_void'];
const ACTIONS        = ['add', 'remove', 'set'];

const firstError = (req) => {
  const errors = validationResult(req);
  return errors.isEmpty() ? null : new ErrorResponse(errors.array()[0].msg, 400);
};

const parseId = (value, label = 'ID') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new ErrorResponse(`Invalid ${label}`, 400);
  return id;
};

// ── Validation ──────────────────────────────────────────────────────
exports.movementValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('action').isIn(ACTIONS).withMessage(`action must be one of: ${ACTIONS.join(', ')}`),
  body('quantity')
    .exists({ checkNull: true }).withMessage('quantity is required')
    .bail()
    .custom((v) => (typeof v === 'number' || typeof v === 'string') && /^\d+$/.test(String(v).trim()))
    .withMessage('quantity must be a whole number (no decimals or negatives)')
    .bail()
    .custom((v) => Number(v) <= Stock.MAX_STOCK)
    .withMessage(`quantity cannot exceed ${Stock.MAX_STOCK.toLocaleString('en-US')} kg`),
  body('quantity').custom((v, { req }) => req.body.action === 'set' || Number(v) >= 1)
    .withMessage('quantity must be at least 1 kg'),
  body('reason').isString().withMessage('reason is required')
    .bail().trim()
    .isLength({ min: 3, max: 255 }).withMessage('reason must be between 3 and 255 characters'),
];

exports.thresholdValidation = [
  param('id').isInt({ min: 1 }).withMessage('Invalid product ID'),
  body('lowStockThreshold')
    .exists({ checkNull: true }).withMessage('lowStockThreshold is required')
    .bail()
    .custom((v) => /^\d+$/.test(String(v).trim()) && Number(v) <= Stock.MAX_STOCK)
    .withMessage('lowStockThreshold must be a whole number between 0 and 10,000,000'),
];

// ── GET /api/v1/stock ───────────────────────────────────────────────
exports.getStock = asyncHandler(async (req, res) => {
  const items = await Stock.list();
  res.status(200).json({
    success: true,
    count: items.length,
    summary: Stock.summarize(items),
    data: items,
  });
});

// ── GET /api/v1/stock/movements ─────────────────────────────────────
exports.getMovements = asyncHandler(async (req, res, next) => {
  const { fromUtc, toUtc } = parseRange(req.query);
  const { page, limit, offset } = parsePaging(req.query, { defaultLimit: 25, maxLimit: 100 });

  let productId = null;
  if (req.query.productId) productId = parseId(req.query.productId, 'productId');

  let type = null;
  if (req.query.type) {
    if (!MOVEMENT_TYPES.includes(req.query.type)) {
      return next(new ErrorResponse(`type must be one of: ${MOVEMENT_TYPES.join(', ')}`, 400));
    }
    type = req.query.type;
  }

  const { rows, total } = await Stock.movements({ productId, type, fromUtc, toUtc, limit, offset });
  res.status(200).json({
    success: true,
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

// ── POST /api/v1/stock/:id/movements  (add | remove | set) ─────────
exports.createMovement = asyncHandler(async (req, res, next) => {
  const err = firstError(req);
  if (err) return next(err);

  const productId = parseId(req.params.id, 'product ID');
  const quantity  = Number(String(req.body.quantity).trim());
  const reason    = req.body.reason.trim();
  const { action } = req.body;
  const meta = { reason, adminId: req.admin.id };

  const movement = await Stock.withTransaction(async (conn) => {
    if (action === 'add')    return Stock.change(conn, productId,  quantity, { ...meta, type: 'restock' });
    if (action === 'remove') return Stock.change(conn, productId, -quantity, { ...meta, type: 'adjustment' });
    return Stock.setTo(conn, productId, quantity, { ...meta, type: 'adjustment' });
  });

  const product = await Stock.findOne(productId);
  res.status(201).json({
    success: true,
    data: { product, movement: { before: movement.before, after: movement.after, change: movement.after - movement.before } },
  });
});

// ── PATCH /api/v1/stock/:id/threshold ───────────────────────────────
exports.updateThreshold = asyncHandler(async (req, res, next) => {
  const err = firstError(req);
  if (err) return next(err);

  const productId = parseId(req.params.id, 'product ID');
  const ok = await Stock.setThreshold(productId, Number(String(req.body.lowStockThreshold).trim()));
  if (!ok) return next(new ErrorResponse('Product not found', 404));

  res.status(200).json({ success: true, data: await Stock.findOne(productId) });
});
