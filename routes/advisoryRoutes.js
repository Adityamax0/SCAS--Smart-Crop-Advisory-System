const express = require('express');
const router = express.Router();
const { getAdvisory } = require('../controllers/advisoryController');
const authenticate = require('../middleware/auth');

// Get personalized government subsidies and crop advice
router.get('/', authenticate, getAdvisory);

module.exports = router;
