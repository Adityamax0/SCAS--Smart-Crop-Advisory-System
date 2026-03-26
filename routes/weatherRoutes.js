const express = require('express');
const router = express.Router();
const { getWeatherAdvisory } = require('../controllers/weatherController');
const authenticate = require('../middleware/auth');

// All roles (Farmer, Worker, Sub-Head) can access weather
router.get('/', authenticate, getWeatherAdvisory);

module.exports = router;
