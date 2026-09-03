const express = require('express');
const { register, login, logout, getMe } = require('../controllers/customerAuthController');
const { updateProfile, getMyOrders, getOrderDetails } = require('../controllers/customerProfileController');
const { getWishlist, addToWishlist, removeFromWishlist } = require('../controllers/wishlistController');

const { protectCustomer } = require('../middleware/customerAuth');

const router = express.Router();

// Auth routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/logout', logout);
router.get('/auth/me', protectCustomer, getMe);

// Profile routes
router.put('/profile', protectCustomer, updateProfile);
router.get('/profile/orders', protectCustomer, getMyOrders);
router.get('/profile/orders/:id', protectCustomer, getOrderDetails);

// Wishlist routes
router.route('/wishlist')
  .get(protectCustomer, getWishlist)
  .post(protectCustomer, addToWishlist);
router.delete('/wishlist/:productId', protectCustomer, removeFromWishlist);

module.exports = router;
