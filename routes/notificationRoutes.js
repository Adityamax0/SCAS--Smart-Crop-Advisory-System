const express = require('express');
const router = express.Router();
const { getMyNotifications, markAsRead } = require('../controllers/notificationController');
const authenticate = require('../middleware/auth');

router.get('/', authenticate, getMyNotifications);
router.patch('/:id/read', authenticate, markAsRead);

module.exports = router;
