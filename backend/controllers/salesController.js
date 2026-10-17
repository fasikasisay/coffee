const Sale           = require('../models/Sale');
const Stock          = require('../models/Stock');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { parseRange, parsePaging } = require('../utils/dateRange');
const { body, validationResult } = require('express-validator');

const PAYMENT_METHODS = ['cash', 'telebirr', 'cbe-birr', 'card'];
const STATUSES        = ['completed', 'voided'];
const SALE_TYPES      = ['paid', 'credit'];
const CREDIT_STATUSES = ['unpaid', 'partial', 'paid'];
const MAX_QTY         = 100_000;

const firstError = (req) => {
  const errors = validationResult(req);
  return errors.isEmpty() ? null : new ErrorResponse(errors.array()[0].msg, 400);
};

const toCents = (v) => Math.round(Number(v) * 100);
const money   = (cents) => (cents / 100).toFixed(2);

/** "123", "123.4", "123.45" — positive, at most 2 decimals, sane upper bound. */
const isMoney = (v) =>
  (typeof v === 'number' || typeof v === 'string') &&
  /^\d{1,9}(\.\d{1,2})?$/.test(String(v).trim()) && Number(v) > 0;

const isPhone = (v) => {
  const t = String(v).trim();
  if (!/^[+()\d][\d\s().-]*$/.test(t)) return false;
  const digits = t.replace(/\D/g, '').length;
  return digits >= 5 && digits <= 15 && t.length <= 40;
};

const isWhole = (v) => (typeof v === 'number' || typeof v === 'string') && /^\d+$/.test(String(v).trim());

// ── Validation ──────────────────────────────────────────────────────
exports.createSaleValidation = [
  body('items').isArray({ min: 1, max: 50 }).withMessage('A sale must contain 1–50 items'),
  body('items.*.productId')
    .custom(isWhole).withMessage('Each item needs a valid productId')
    .bail()
    .custom((v) => Number(v) >= 1).withMessage('Each item needs a valid productId'),
  body('items.*.quantity')
    .custom(isWhole).withMessage('Quantity must be a whole number of kg')
    .bail()
    .custom((v) => Number(v) >= 1 && Number(v) <= MAX_QTY)
    .withMessage(`Quantity must be between 1 and ${MAX_QTY.toLocaleString('en-US')}`),
  body('saleType').optional()
    .isIn(SALE_TYPES).withMessage(`saleType must be one of: ${SALE_TYPES.join(', ')}`),
  // A paid sale needs a payment method; a credit sale is paid later, so it has none.
  body('paymentMethod').custom((v, { req }) =>
    req.body.saleType === 'credit' || PAYMENT_METHODS.includes(v))
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('customerName').optional({ nullable: true, checkFalsy: true })
    .isString().bail().trim().isLength({ max: 120 }).withMessage('Customer name must be under 120 characters'),
  body('customerName').custom((v, { req }) =>
    req.body.saleType !== 'credit' || (typeof v === 'string' && v.trim().length >= 2))
    .withMessage('Customer name is required for credit sales (at least 2 characters)'),
  body('customerPhone').optional({ nullable: true, checkFalsy: true })
    .custom(isPhone).withMessage('Contact must be a valid phone number (5–15 digits)'),
  body('notes').optional({ nullable: true, checkFalsy: true })
    .isString().bail().trim().isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
];

exports.paymentValidation = [
  body('amount').custom(isMoney)
    .withMessage('Amount must be a positive number with at most 2 decimals'),
  body('paymentMethod').isIn(PAYMENT_METHODS)
    .withMessage(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`),
  body('note').optional({ nullable: true, checkFalsy: true })
    .isString().bail().trim().isLength({ max: 255 }).withMessage('Note must be under 255 characters'),
];

exports.voidSaleValidation = [
  body('reason').isString().withMessage('A reason is required to void a sale')
    .bail().trim()
    .isLength({ min: 3, max: 255 }).withMessage('Reason must be between 3 and 255 characters'),
];

// ── POST /api/v1/sales ──────────────────────────────────────────────
exports.createSale = asyncHandler(async (req, res, next) => {
  const err = firstError(req);
  if (err) return next(err);

  const saleType      = req.body.saleType === 'credit' ? 'credit' : 'paid';
  const isCredit      = saleType === 'credit';
  const paymentMethod = isCredit ? null : req.body.paymentMethod;
  const customerName  = req.body.customerName ? String(req.body.customerName).trim() : null;
  const customerPhone = req.body.customerPhone ? String(req.body.customerPhone).trim() : null;
  const notes         = req.body.notes ? String(req.body.notes).trim() : null;

  // Merge duplicate product lines, then sort by id so concurrent sales lock
  // product rows in the same order (prevents deadlocks).
  const wanted = new Map();
  for (const it of req.body.items) {
    const pid = Number(it.productId);
    wanted.set(pid, (wanted.get(pid) || 0) + Number(it.quantity));
  }
  for (const [pid, qty] of wanted) {
    if (qty > MAX_QTY) {
      return next(new ErrorResponse(`Total quantity for product ${pid} cannot exceed ${MAX_QTY.toLocaleString('en-US')}`, 400));
    }
  }
  const lines = [...wanted.entries()].sort((a, b) => a[0] - b[0]);

  const saleId = await Stock.withTransaction(async (conn) => {
    const { id, saleNumber } = await Sale.create(conn, {
      saleType, paymentMethod, customerName, customerPhone, notes, adminId: req.admin.id,
    });

    let totalCents = 0;
    let totalQty   = 0;

    for (const [productId, quantity] of lines) {
      // Locks the product row, checks stock >= quantity, deducts, logs the movement.
      const moved = await Stock.change(conn, productId, -quantity, {
        type: 'sale', reason: `${isCredit ? 'Credit sale' : 'Walk-in sale'} ${saleNumber}`,
        refType: 'sale', refId: id, adminId: req.admin.id,
      });

      const unitCents = Math.round(Number(moved.pricePerKg) * 100);
      const lineCents = unitCents * quantity;
      totalCents += lineCents;
      totalQty   += quantity;

      await Sale.addItem(conn, id, {
        productId, name: moved.name, quantity,
        unitPrice: unitCents / 100, lineTotal: lineCents / 100,
      });
    }

    await Sale.setTotals(conn, id, totalCents / 100, totalQty);
    return id;
  });

  res.status(201).json({ success: true, data: await Sale.findById(saleId) });
});

// ── GET /api/v1/sales ───────────────────────────────────────────────
exports.getSales = asyncHandler(async (req, res, next) => {
  const { fromUtc, toUtc } = parseRange(req.query);
  const { page, limit, offset } = parsePaging(req.query, { defaultLimit: 25, maxLimit: 100 });

  const { paymentMethod, status, type, creditStatus } = req.query;
  if (type && !SALE_TYPES.includes(type)) {
    return next(new ErrorResponse(`type must be one of: ${SALE_TYPES.join(', ')}`, 400));
  }
  if (creditStatus && !CREDIT_STATUSES.includes(creditStatus)) {
    return next(new ErrorResponse(`creditStatus must be one of: ${CREDIT_STATUSES.join(', ')}`, 400));
  }
  let q = null;
  if (req.query.q !== undefined && req.query.q !== '') {
    if (typeof req.query.q !== 'string' || req.query.q.length > 100) {
      return next(new ErrorResponse('Search text must be under 100 characters', 400));
    }
    q = req.query.q.trim() || null;
  }
  if (paymentMethod && !PAYMENT_METHODS.includes(paymentMethod)) {
    return next(new ErrorResponse(`paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`, 400));
  }
  if (status && !STATUSES.includes(status)) {
    return next(new ErrorResponse(`status must be one of: ${STATUSES.join(', ')}`, 400));
  }

  const { rows, total } = await Sale.findAll({
    fromUtc, toUtc, saleType: type || null, paymentMethod: paymentMethod || null,
    status: status || null, creditStatus: creditStatus || null, q, limit, offset,
  });
  res.status(200).json({
    success: true,
    data: rows,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  });
});

// ── GET /api/v1/sales/stats ─────────────────────────────────────────
exports.getSaleStats = asyncHandler(async (req, res) => {
  const { fromUtc, toUtc, tz } = parseRange(req.query);
  const stats = await Sale.stats({ fromUtc, toUtc, tz });
  res.status(200).json({ success: true, data: stats });
});

// ── POST /api/v1/sales/:id/void ─────────────────────────────────────
exports.voidSale = asyncHandler(async (req, res, next) => {
  const err = firstError(req);
  if (err) return next(err);

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next(new ErrorResponse('Invalid sale ID', 400));
  const reason = req.body.reason.trim();

  await Stock.withTransaction(async (conn) => {
    const sale = await Sale.lockById(conn, id);
    if (!sale) throw new ErrorResponse('Sale not found', 404);
    if (sale.status === 'voided') throw new ErrorResponse('This sale has already been voided', 400);
    if (sale.saleType === 'credit' && toCents(sale.amountPaid) > 0) {
      throw new ErrorResponse(
        `${sale.saleNumber} already has $${money(toCents(sale.amountPaid))} in payments recorded and cannot be voided`, 400);
    }

    // Return the sold quantities to stock (items whose product was deleted can't be restored).
    for (const item of await Sale.itemsForSale(conn, id)) {
      if (item.productId == null) continue;
      await Stock.change(conn, item.productId, item.quantity, {
        type: 'sale_void', reason: `Sale ${sale.saleNumber} voided: ${reason}`,
        refType: 'sale', refId: id, adminId: req.admin.id,
      });
    }
    await Sale.markVoided(conn, id, reason);
  });

  res.status(200).json({ success: true, data: await Sale.findById(id) });
});

// ── POST /api/v1/sales/:id/payments  (record a payment on a credit sale) ─
exports.recordPayment = asyncHandler(async (req, res, next) => {
  const err = firstError(req);
  if (err) return next(err);

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return next(new ErrorResponse('Invalid sale ID', 400));

  const amountCents   = toCents(String(req.body.amount).trim());
  const paymentMethod = req.body.paymentMethod;
  const note          = req.body.note ? String(req.body.note).trim() : null;

  await Stock.withTransaction(async (conn) => {
    const sale = await Sale.lockById(conn, id);
    if (!sale) throw new ErrorResponse('Sale not found', 404);
    if (sale.saleType !== 'credit') throw new ErrorResponse('Only credit sales can receive payments', 400);
    if (sale.status === 'voided')   throw new ErrorResponse('This sale has been voided', 400);

    const balanceCents = toCents(sale.totalAmount) - toCents(sale.amountPaid);
    if (balanceCents <= 0) throw new ErrorResponse('This credit sale is already fully paid', 400);
    if (amountCents > balanceCents) {
      throw new ErrorResponse(
        `Payment of $${money(amountCents)} is more than the outstanding balance of $${money(balanceCents)}`, 400);
    }
    await Sale.addCreditPayment(conn, sale, { amountCents, paymentMethod, note, adminId: req.admin.id });
  });

  res.status(201).json({ success: true, data: await Sale.findById(id) });
});
