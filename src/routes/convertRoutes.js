const express = require('express');
const multer = require('multer');
const { convertFile } = require('../controllers/convertController');
const { compressFile } = require('../controllers/compressController');

const router = express.Router();

// Configure multer: in-memory storage, max 100 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported: ${file.mimetype}`));
    }
  },
});

// Multer error handler
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
}

// POST /convert
router.post('/convert', upload.single('file'), handleMulterError, convertFile);

// POST /compress
router.post('/compress', upload.single('file'), handleMulterError, compressFile);

module.exports = router;
