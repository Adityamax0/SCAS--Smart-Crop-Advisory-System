const express = require('express');
const router = express.Router();
const os = require('os');
const multer = require('multer');
const { processAudio } = require('../controllers/audioController');
const { authenticate, optionalAuth } = require('../middleware/auth');

// We use the OS temp directory so it doesn't clutter the project
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    cb(null, `voice-${Date.now()}.wav`); // Groq Whisper requires an extension
  }
});
const upload = multer({ storage });

// POST /api/audio/process uses optionalAuth so public homepage visitors can use KrishiMitra
router.post('/process', optionalAuth, upload.single('audio'), processAudio);

module.exports = router;
