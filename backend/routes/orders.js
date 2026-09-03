const express = require('express');
const router  = express.Router();
const {
  getOrders,
  getOrder,
  createOrder,
  createOrderValidation,
  updateOrderStatus,
} = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

const { optionalCustomerAuth } = require('../middleware/customerAuth');

// Public — storefront order submission (no auth required)
router.post('/', optionalCustomerAuth, createOrderValidation, createOrder);

// Admin read access — any active admin or superadmin may view orders
router.get('/',     protect, authorize('admin', 'superadmin'), getOrders);
router.get('/:id',  protect, authorize('admin', 'superadmin'), getOrder);

// Status changes — any active admin or superadmin (operational role)
router.patch('/:id/status', protect, authorize('admin', 'superadmin'), updateOrderStatus);

module.exports = router;
