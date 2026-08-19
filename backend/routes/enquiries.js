const express = require('express');
const router = express.Router();
const {
  getEnquiries,
  getEnquiry,
  createEnquiry,
  createEnquiryValidation,
  updateEnquiryStatus,
} = require('../controllers/enquiryController');
const { protect, authorize } = require('../middleware/auth');

// Public — storefront contact form submission (no auth required)
router.post('/', createEnquiryValidation, createEnquiry);

// Admin read access — any active admin or superadmin may view enquiries
router.get('/',    protect, authorize('admin', 'superadmin'), getEnquiries);
router.get('/:id', protect, authorize('admin', 'superadmin'), getEnquiry);

// Status changes — any active admin or superadmin (operational role)
router.patch('/:id/status', protect, authorize('admin', 'superadmin'), updateEnquiryStatus);

module.exports = router;
