const express = require('express');
const router  = express.Router();
const {
  createSale, createSaleValidation, getSales, getSaleStats,
  voidSale, voidSaleValidation,
  recordPayment, paymentValidation,
} = require('../controllers/salesController');
const { protect, authorize } = require('../middleware/auth');

// Every sales route is admin-only
router.use(protect, authorize('admin', 'superadmin'));

router.get('/stats',     getSaleStats);                // must stay above '/:id/...'
router.get('/',          getSales);
router.post('/',         createSaleValidation, createSale);
router.post('/:id/void',     voidSaleValidation, voidSale);
router.post('/:id/payments', paymentValidation,  recordPayment);

module.exports = router;
