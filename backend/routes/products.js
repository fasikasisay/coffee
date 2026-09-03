const express = require('express');
const router  = express.Router();
const uploadProductImage = require('../middleware/upload');
const {
  getProducts,
  getProduct,
  createProduct,
  createProductValidation,
  updateProduct,
  updateProductValidation,
  deleteProduct,
} = require('../controllers/productController');
const { protect, authorize } = require('../middleware/auth');

// Public 
router.get('/',    getProducts);
router.get('/:id', getProduct);

// Admin write access 
router.post('/',   protect, authorize('admin', 'superadmin'), uploadProductImage.single('image'), createProductValidation, createProduct);
router.put('/:id', protect, authorize('admin', 'superadmin'), uploadProductImage.single('image'), updateProductValidation, updateProduct);

// Destructive delete — superadmin only
router.delete('/:id', protect, authorize('superadmin'), deleteProduct);

module.exports = router;
