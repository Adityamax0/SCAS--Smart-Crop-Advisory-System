const express = require('express');
const { getOperationalStats } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');
const authorize = require('../middleware/rbac');

const router = express.Router();

// Only Sub-Heads and Admins can view analytics
router.get('/operational', authenticate, authorize('subhead', 'admin'), getOperationalStats);

module.exports = router;
