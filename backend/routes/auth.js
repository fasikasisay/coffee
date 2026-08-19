const express = require('express');
const router  = express.Router();
const {
  login,
  loginValidation,
  logout,
  getMe,
  updatePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/login',           loginValidation, login);
router.get('/logout',           protect, logout);
router.get('/me',               protect, getMe);
router.put('/updatepassword',   protect, updatePassword);

module.exports = router;
