const Enquiry        = require('../models/Enquiry');
const ErrorResponse  = require('../utils/errorResponse');
const asyncHandler   = require('../middleware/async');
const { body, validationResult } = require('express-validator');

const VALID_STATUSES = ['new', 'read', 'responded', 'archived'];

// ── Input validation rules for createEnquiry ───────────────────────
exports.createEnquiryValidation = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 120 }).withMessage('Name must be 2–120 characters'),
  body('email')
    .trim().isEmail().withMessage('Valid email is required')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email too long'),
  body('message')
    .trim().notEmpty().withMessage('Message is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Message must be 10–2000 characters'),
];

// ── @route  POST /api/v1/enquiries  (public — storefront contact form) ──
exports.createEnquiry = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const { name, email, message } = req.body;
  const enquiry = await Enquiry.create({ name, email, message });

  res.status(201).json({ success: true, data: enquiry });
});

// ── @route  GET /api/v1/enquiries  (admin only) ────────────────────
exports.getEnquiries = asyncHandler(async (req, res) => {
  const enquiries = await Enquiry.findAll();
  res.status(200).json({ success: true, count: enquiries.length, data: enquiries });
});

// ── @route  GET /api/v1/enquiries/:id  (admin only) ────────────────
exports.getEnquiry = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid enquiry ID', 400));
  }
  const enquiry = await Enquiry.findById(id);
  if (!enquiry) return next(new ErrorResponse('Enquiry not found', 404));
  res.status(200).json({ success: true, data: enquiry });
});

// ── @route  PATCH /api/v1/enquiries/:id/status  (admin only) ───────
exports.updateEnquiryStatus = asyncHandler(async (req, res, next) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) {
    return next(new ErrorResponse('Invalid enquiry ID', 400));
  }
  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) {
    return next(new ErrorResponse(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 400));
  }
  const existing = await Enquiry.findById(id);
  if (!existing) return next(new ErrorResponse('Enquiry not found', 404));

  const updated = await Enquiry.updateStatus(id, status);
  res.status(200).json({ success: true, data: updated });
});
