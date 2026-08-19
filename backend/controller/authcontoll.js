const { body, validationResult } = require('express-validator');
const Admin             = require('../models/Admin');
const ErrorResponse     = require('../utils/errorResponse');
const asyncHandler      = require('../middleware/async');
const sendTokenResponse = require('../utils/sendToken');

// ── Validation rules ──────────────────────────────────────────────
exports.loginValidation = [
  body('email')
    .trim().isEmail().withMessage('Provide a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 128 }).withMessage('Password too long'),
];

// ── POST /api/v1/auth/login ───────────────────────────────────────
exports.login = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const { email, password } = req.body;

  const adminWithPw = await Admin.findByEmail(email, true);

  
  if (!adminWithPw) {
    return next(new ErrorResponse('Invalid email or password', 401));
  }
  if (!adminWithPw.isActive) {
    return next(new ErrorResponse('This account has been deactivated', 403));
  }

  const isMatch = await Admin.matchPassword(password, adminWithPw.password);
  if (!isMatch) {
    return next(new ErrorResponse('Invalid email or password', 401));
  }

  await Admin.updateLastLogin(adminWithPw.id);

  const admin = await Admin.findById(adminWithPw.id);
  sendTokenResponse(admin, 200, res);
});

// ── GET /api/v1/auth/logout ───────────────────────────────────────
exports.logout = asyncHandler(async (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('token', 'none', {
    httpOnly:  true,
    secure:    isProd,
    sameSite:  isProd ? 'strict' : 'lax',
    maxAge:    5000,    // expire in 5 s
    path:      '/',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});


exports.getMe = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin.id);
  res.status(200).json({ success: true, data: admin });
});


exports.updatePassword = asyncHandler(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new ErrorResponse('currentPassword and newPassword are required', 400));
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return next(new ErrorResponse('New password must be at least 8 characters', 400));
  }
  if (newPassword.length > 128) {
    return next(new ErrorResponse('Password too long', 400));
  }

  const hash    = await Admin.getPasswordById(req.admin.id);
  const isMatch = await Admin.matchPassword(currentPassword, hash);
  if (!isMatch) {
    return next(new ErrorResponse('Current password is incorrect', 401));
  }

  await Admin.updatePassword(req.admin.id, newPassword);

  const admin = await Admin.findById(req.admin.id);
  sendTokenResponse(admin, 200, res);
});
