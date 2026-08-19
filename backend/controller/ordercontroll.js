const { pool }       = require('../config/db');
const Order          = require('../models/Order');
const Product        = require('../models/Product');
const Customer       = require('../models/Customer');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { body, validationResult } = require('express-validator');

const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

// ── Input validation rules for createOrder (public) 
exports.createOrderValidation = [
  body('customer.name')
    .trim().notEmpty().withMessage('Customer name is required')
    .isLength({ max: 120 }).withMessage('Name too long'),
  body('customer.email')
    .trim().isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email too long'),
  body('customer.company')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 200 }).withMessage('Company name too long'),
  body('customer.country')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Country too long'),
  body('customer.phone')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 30 }).withMessage('Phone too long'),
  body('items')
    .isArray({ min: 1, max: 50 }).withMessage('Order must contain 1–50 items'),
 body('items.*.productId')
  .notEmpty().withMessage('Each order item must have a productId')
  .isInt({ min: 1 }).withMessage('Each item productId must be a positive integer'),
  body('items.*.quantity')
    .isInt({ min: 1, max: 100_000 }).withMessage('Quantity must be between 1 and 100,000'),
  body('notes')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 1000 }).withMessage('Notes must be under 1000 characters'),

  
  body('shippingAddress.street')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 255 }).withMessage('Shipping street must be under 255 characters')
    .isLength({ min: 0 }),  
  body('shippingAddress.city')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Shipping city must be under 100 characters'),
  body('shippingAddress.country')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 100 }).withMessage('Shipping country must be under 100 characters'),
  body('shippingAddress.postalCode')
    .optional({ nullable: true, checkFalsy: true })
    .trim().isLength({ max: 20 }).withMessage('Postal code must be under 20 characters')
    .matches(/^[A-Za-z0-9 -]{0,20}$/).withMessage('Postal code contains invalid characters'),
];

// ── @route  GET /api/v1/orders 
exports.getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.findAll();
  res.status(200).json({ success: true, count: orders.length, data: orders });
});

// ── @route  GET /api/v1/orders/:id 
exports.getOrder = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid order ID', 400));
  }
  const order = await Order.findById(id);
  if (!order) return next(new ErrorResponse('Order not found', 404));
  res.status(200).json({ success: true, data: order });
});

// ── @route  POST /api/v1/orders  (public — storefront) 
exports.createOrder = asyncHandler(async (req, res, next) => {
  // 1. Validate request shape
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const { customer, items, notes, shippingAddress } = req.body;

  // 2. Open a transaction so price lookup + stock deduction + insert are atomic
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let serverTotal = 0;
    const resolvedItems = [];

  for (const item of items) {
  
  if (
    !Number.isInteger(Number(item.productId)) ||
    Number(item.productId) < 1
  ) {
    throw new ErrorResponse(
      'Every order item must be a valid product. Services must be submitted as enquiries.',
      400
    );
  }

  // 3. Lock the product row for this transaction
  const product = await Product.findByIdForUpdate(
    item.productId,
    conn
  );

     if (!product) {
  throw new ErrorResponse(
    `Product ID ${item.productId} not found`,
    404
  );
}
    if (!product.isAvailable) {
  throw new ErrorResponse(
    `"${product.name}" is no longer available`,
    400
  );
}

      // 4. Quantity must meet minimum order
     if (item.quantity < product.minOrderKg) {
  throw new ErrorResponse(
    `Minimum order for "${product.name}" is ${product.minOrderKg} kg`,
    400
  );
}

      // 5. Stock check
      if (product.stock < item.quantity) {
  throw new ErrorResponse(
    `Insufficient stock for "${product.name}" — only ${product.stock} kg available`,
    400
  );
}

      const deducted = await Product.deductStock(item.productId, item.quantity, conn);
    if (!deducted) {
  throw new ErrorResponse(
    `Stock changed for "${product.name}" — please retry`,
    409
  );
}


      const lineTotal = Number(product.pricePerKg) * item.quantity;
      serverTotal += lineTotal;

      resolvedItems.push({
        productId: product.id,
        name:      product.name,
        quantity:  item.quantity,
        unitPrice: Number(product.pricePerKg),  
      });
    }

    
    const [numRows] = await conn.execute(
      `SELECT COALESCE(MAX(id), 0) AS maxId FROM orders FOR UPDATE`
    );
    const orderNumber = `MC-${String(numRows[0].maxId + 1).padStart(5, '0')}`;

    // 9. Insert order
    const cleanedCustomer = {
      name:    customer.name.trim(),
      email:   customer.email.toLowerCase().trim(),
      company: customer.company ? customer.company.trim()  : null,
      country: customer.country ? customer.country.trim()  : null,
      phone:   customer.phone   ? customer.phone.trim()    : null,
    };

    const [orderResult] = await conn.execute(`
      INSERT INTO orders (
        order_number, customer_name, customer_email, customer_company,
        customer_country, customer_phone,
        total_amount, status, notes,
        shipping_street, shipping_city, shipping_country, shipping_postal_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `, [
      orderNumber,
      cleanedCustomer.name, cleanedCustomer.email,
      cleanedCustomer.company, cleanedCustomer.country, cleanedCustomer.phone,
      serverTotal,
      notes ? notes.trim().slice(0, 1000) : null,
      shippingAddress?.street  ? shippingAddress.street.trim()  : null,
      shippingAddress?.city    ? shippingAddress.city.trim()    : null,
      shippingAddress?.country ? shippingAddress.country.trim() : null,
      shippingAddress?.postalCode ? shippingAddress.postalCode.trim() : null,
    ]);

    const orderId = orderResult.insertId;

    // 10. Insert line items
    for (const item of resolvedItems) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, name, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.productId, item.name, item.quantity, item.unitPrice]
      );
    }

    await conn.commit();
    

    
    Customer.upsert(cleanedCustomer)
      .then(cid => Customer.incrementStats(cid, serverTotal))
      .catch(() => {});  // never fail the order response on this

    const order = await Order.findById(orderId);
    res.status(201).json({ success: true, data: order });

    } catch (err) {
    try {
      await conn.rollback();
    } catch {}

    throw err;

  } finally {
    conn.release();
  }
});

// ── @route  PATCH /api/v1/orders/:id/status  (admin only) 
exports.updateOrderStatus = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid order ID', 400));
  }

  const { status } = req.body;
  if (!status || !VALID_STATUSES.includes(status)) {
    return next(
      new ErrorResponse(`status must be one of: ${VALID_STATUSES.join(', ')}`, 400)
    );
  }

  const order = await Order.updateStatus(id, status);
  if (!order) return next(new ErrorResponse('Order not found', 404));

  res.status(200).json({ success: true, data: order });
});
