const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// Send JWT in cookie
const sendTokenResponse = (customer, statusCode, res) => {
  const token = jwt.sign({ id: customer.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });

  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
    options.sameSite = 'none';
  }

  // Remove password before sending
  const { password, ...customerData } = customer;

  res
    .status(statusCode)
    .cookie('customer_token', token, options)
    .json({
      success: true,
      token,
      data: customerData,
    });
};

// @desc    Register a customer
// @route   POST /api/v1/customers/auth/register
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return next(
      new ErrorResponse('Please provide name, email, and password', 400)
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check if customer already exists
  const [existing] = await pool.query(
    'SELECT * FROM customers WHERE email = ?',
    [normalizedEmail]
  );

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Customer already exists
  if (existing.length > 0) {
    const customer = existing[0];

    // Already a registered customer
    if (customer.password) {
      return next(
        new ErrorResponse('Email already registered', 400)
      );
    }

    // Existing guest customer:
    // Add password to the existing account
    await pool.query(
      `UPDATE customers
       SET name = ?, password = ?
       WHERE id = ?`,
      [name.trim(), hashedPassword, customer.id]
    );

    // Get updated customer
    const [rows] = await pool.query(
      'SELECT * FROM customers WHERE id = ?',
      [customer.id]
    );

    sendTokenResponse(rows[0], 201, res);
    return;
  }

  // Create completely new customer
  const [result] = await pool.query(
    'INSERT INTO customers (name, email, password) VALUES (?, ?, ?)',
    [name.trim(), normalizedEmail, hashedPassword]
  );

  const [rows] = await pool.query(
    'SELECT * FROM customers WHERE id = ?',
    [result.insertId]
  );

  sendTokenResponse(rows[0], 201, res);
});

// @desc    Login a customer
// @route   POST /api/v1/customers/auth/login
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(new ErrorResponse('Please provide email and password', 400));
  }

  const [rows] = await pool.query('SELECT * FROM customers WHERE email = ?', [email]);
  const customer = rows[0];

  if (!customer) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }
  
  if(!customer.password) {
     return next(new ErrorResponse('This account does not have a password set up. Please contact support.', 401));
  }

  const isMatch = await bcrypt.compare(password, customer.password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  if (!customer.is_active) {
    return next(new ErrorResponse('Account is deactivated', 403));
  }

  sendTokenResponse(customer, 200, res);
});

// @desc    Logout customer
// @route   GET /api/v1/customers/auth/logout
exports.logout = asyncHandler(async (req, res, next) => {
  res.cookie('customer_token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });

  res.status(200).json({ success: true, data: {} });
});

// @desc    Get current logged-in customer
// @route   GET /api/v1/customers/auth/me
exports.getMe = asyncHandler(async (req, res, next) => {
  const customer = req.customer;
  const { password, ...customerData } = customer;
  res.status(200).json({
    success: true,
    data: customerData
  });
});
