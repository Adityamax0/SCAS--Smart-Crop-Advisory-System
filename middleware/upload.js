const multer = require('multer');

// Memory storage — files stay in buffer for direct Cloudinary streaming
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedImage = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedAudio = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'];
  const allowed = [...allowedImage, ...allowedAudio];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' is not supported. Allowed: ${allowed.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max per file
    files: 5, // max 5 files per request
  },
});

module.exports = upload;
