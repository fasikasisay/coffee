const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('./async');

exports.protectCustomer = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.customer_token;

  if (!token || token === 'none') {
    return next(new ErrorResponse('Not authorised — please log in', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new ErrorResponse('Session expired — please log in again', 401));
    }
    return next(new ErrorResponse('Not authorised — invalid session', 401));
  }

  const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [decoded.id]);
  const customer = rows[0];

  if (!customer) {
    return next(new ErrorResponse('Customer account not found', 401));
  }
  if (!customer.is_active) {
    return next(new ErrorResponse('This account has been deactivated — contact support', 403));
  }

  req.customer = customer;
  next();
});

exports.optionalCustomerAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.customer_token;
  if (!token || token === 'none') {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT * FROM customers WHERE id = ?', [decoded.id]);
    const customer = rows[0];
    if (customer && customer.is_active) {
      req.customer = customer;
    }
  } catch (err) {
    // silently fail
  }
  next();
});
