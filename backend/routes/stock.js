const express = require('express');
const router  = express.Router();
const {
  getStock, getMovements, createMovement, movementValidation,
  updateThreshold, thresholdValidation,
} = require('../controllers/stockController');
const { protect, authorize } = require('../middleware/auth');

// Every stock route is admin-only
router.use(protect, authorize('admin', 'superadmin'));

router.get('/',                getStock);
router.get('/movements',       getMovements);          // must stay above '/:id/...'
router.post('/:id/movements',  movementValidation, createMovement);
router.patch('/:id/threshold', thresholdValidation, updateThreshold);

module.exports = router;
