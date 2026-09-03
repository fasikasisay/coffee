const { pool } = require('../config/db');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Update customer profile
// @route   PUT /api/v1/customers/profile
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { name, company, phone, street, city, postal_code, country } = req.body;
  
  await pool.query(
    'UPDATE customers SET name = ?, company = ?, phone = ?, street = ?, city = ?, postal_code = ?, country = ? WHERE id = ?',
    [
      name || req.customer.name,
      company || req.customer.company,
      phone || req.customer.phone,
      street || req.customer.street,
      city || req.customer.city,
      postal_code || req.customer.postal_code,
      country || req.customer.country,
      req.customer.id
    ]
  );

  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [req.customer.id]);
  const { password, ...customerData } = rows[0];

  res.status(200).json({
    success: true,
    data: customerData
  });
});

// @desc    Get logged in user orders
// @route   GET /api/v1/customers/profile/orders
exports.getMyOrders = asyncHandler(async (req, res, next) => {
  const [orders] = await pool.query(
    'SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC',
    [req.customer.id]
  );

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders
  });
});

// @desc    Get specific order details
// @route   GET /api/v1/customers/profile/orders/:id
exports.getOrderDetails = asyncHandler(async (req, res, next) => {
  const [orders] = await pool.query(
    'SELECT * FROM orders WHERE id = ? AND customer_id = ?',
    [req.params.id, req.customer.id]
  );
  
  const order = orders[0];
  if (!order) {
    return next(new ErrorResponse('Order not found', 404));
  }

  const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
  order.items = items;

  res.status(200).json({
    success: true,
    data: order
  });
});
