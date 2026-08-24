const express = require('express');
const router = express.Router();

const {
  getBusinessSettings,
  updateBusinessSettings,
  updateBusinessSettingsValidation
} = require('../controllers/businessSettingsController');

const { protect, authorize } = require('../middleware/auth');


// Logged-in admin can view settings
router.get(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  getBusinessSettings
);


// Logged-in admin can update settings
router.put(
  '/',
  protect,
  authorize('admin', 'superadmin'),
  updateBusinessSettingsValidation,
  updateBusinessSettings
);

module.exports = router;