const express = require('express');
const { syncOfflineTickets } = require('../controllers/syncController');
const authenticate = require('../middleware/auth');

const router = express.Router();

// Idempotent sync endpoint — accepts batched offline tickets
router.post('/', authenticate, syncOfflineTickets);

module.exports = router;
