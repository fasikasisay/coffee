const { pool } = require('../config/db');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get customer wishlist
// @route   GET /api/v1/customers/wishlist
exports.getWishlist = asyncHandler(async (req, res, next) => {
  const [items] = await pool.query(
    `SELECT p.* 
     FROM wishlists w 
     JOIN products p ON w.product_id = p.id 
     WHERE w.customer_id = ? 
     ORDER BY w.created_at DESC`,
    [req.customer.id]
  );

  res.status(200).json({
    success: true,
    count: items.length,
    data: items
  });
});

// @desc    Add product to wishlist
// @route   POST /api/v1/customers/wishlist
exports.addToWishlist = asyncHandler(async (req, res, next) => {
  const { productId } = req.body;

  if (!productId) {
    return next(new ErrorResponse('Please provide a product ID', 400));
  }

  // Check product exists
  const [products] = await pool.query('SELECT id FROM products WHERE id = ?', [productId]);
  if (products.length === 0) {
    return next(new ErrorResponse('Product not found', 404));
  }

  // Add (ignore if already exists)
  await pool.query(
    'INSERT IGNORE INTO wishlists (customer_id, product_id) VALUES (?, ?)',
    [req.customer.id, productId]
  );

  res.status(200).json({
    success: true,
    message: 'Added to wishlist'
  });
});

// @desc    Remove product from wishlist
// @route   DELETE /api/v1/customers/wishlist/:productId
exports.removeFromWishlist = asyncHandler(async (req, res, next) => {
  const { productId } = req.params;

  await pool.query(
    'DELETE FROM wishlists WHERE customer_id = ? AND product_id = ?',
    [req.customer.id, productId]
  );

  res.status(200).json({
    success: true,
    message: 'Removed from wishlist'
  });
});
