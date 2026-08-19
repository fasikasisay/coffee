const jwt           = require('jsonwebtoken');
const Admin         = require('../models/Admin');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler  = require('./async').default;


exports.protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.token;

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

  const admin = await Admin.findById(decoded.id);

  if (!admin) {
    return next(new ErrorResponse('Admin account not found', 401));
  }
  if (!admin.isActive) {
    return next(new ErrorResponse('This account has been deactivated — contact support', 403));
  }

  req.admin = admin;
  next();
});

// ── authorize 
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.admin || !roles.includes(req.admin.role)) {
    return next(
      new ErrorResponse('You do not have permission to perform this action', 403)
    );
  }
  next();
};
