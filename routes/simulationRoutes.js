const express = require('express');
const router = express.Router();
const simulationController = require('../controllers/simulationController');
const { protect, restrictTo } = require('../middleware/auth');

/**
 * 🌪️ SCAS: Digital Twin Simulation Routes
 * These endpoints allow scenario injection for demonstration and testing.
 * Strictly restricted to Admins.
 */

router.post(
  '/trigger',
  protect,
  restrictTo('admin'),
  simulationController.triggerScenario
);

module.exports = router;
