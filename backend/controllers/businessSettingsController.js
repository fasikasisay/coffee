const BusinessSettings = require('../models/BusinessSettings');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const { body, validationResult } = require('express-validator');


exports.updateBusinessSettingsValidation = [
  body('businessName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Business name cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Business name must be under 150 characters'),

  body('businessEmail')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 }),

  body('businessPhone')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 50 })
    .withMessage('Phone number must be under 50 characters'),

  body('businessAddress')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address must be under 255 characters'),

  body('businessWebsite')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('Please provide a valid website URL')
    .isLength({ max: 255 }),

  body('businessLogo')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isURL()
    .withMessage('Please provide a valid logo URL')
    .isLength({ max: 500 }),
];


// GET /api/v1/business-settings
exports.getBusinessSettings = asyncHandler(async (_req, res, next) => {
  const settings = await BusinessSettings.get();

  if (!settings) {
    return next(new ErrorResponse('Business settings not found', 404));
  }

  res.status(200).json({
    success: true,
    data: settings
  });
});


// PUT /api/v1/business-settings
exports.updateBusinessSettings = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new ErrorResponse(errors.array()[0].msg, 400));
  }

  const updatedSettings = await BusinessSettings.update(req.body);

  res.status(200).json({
    success: true,
    data: updatedSettings
  });
});