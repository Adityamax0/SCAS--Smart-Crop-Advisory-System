const express = require('express');
const {
  createTicket,
  getTickets,
  getTicketById,
  updateTicketStatus,
  escalateTicket,
  scanDisease,
} = require('../controllers/ticketController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const upload = require('../middleware/upload');

const router = express.Router();

// All ticket routes require authentication
router.use(authenticate);

// Farmer creates ticket (with optional media)
router.post('/', upload.array('media', 5), createTicket);

// Farmer scans disease (instant AI result)
router.post('/scan-disease', upload.single('image'), scanDisease);

// Get tickets (role-scoped)
router.get('/', getTickets);

// Get single ticket
router.get('/:id', getTicketById);

// Update ticket status (Worker, SubHead, Admin)
router.patch('/:id/status', authorize('worker', 'subhead', 'admin'), updateTicketStatus);

// Upload proof-of-work only (for worker resolution)
const { uploadProof } = require('../controllers/ticketController');
router.post('/upload-only', authorize('worker'), upload.single('image'), uploadProof);

// Escalate a ticket (Worker, SubHead)
router.post('/:id/escalate', authorize('worker', 'subhead'), escalateTicket);

module.exports = router;
