const express = require('express');
const rateLimit = require('express-rate-limit'); // Import rateLimit
const { register, login, getMe, getDemoCredentials } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Dev-friendly rate limiting for testing (prevent lockout)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Allow 1000 requests per 15 minutes per IP
  message: { success: false, message: 'Too many auth attempts. Please try again later.' },
});

// Public routes
router.post('/register', register);
router.post('/login', loginLimiter, login); // Apply the loginLimiter to the login route
router.get('/demo-credentials', getDemoCredentials);

// Protected routes
router.get('/me', authenticate, getMe);

module.exports = router;
