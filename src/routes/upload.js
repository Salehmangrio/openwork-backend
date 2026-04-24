const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { uploadAvatar, uploadOfferThumbnail, cloudinary } = require('../middleware/upload');
const multer = require('multer');
const path = require('path');

// Local storage for files (not avatars)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '-')}`),
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|zip|mp4|webm/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.test(ext)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Avatar upload using Cloudinary
router.post('/avatar', protect, uploadAvatar, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({ success: true, url: req.file.path });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
});

// Offer thumbnail upload using Cloudinary
router.post('/offer-thumbnail', protect, uploadOfferThumbnail, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    res.json({ success: true, url: req.file.path, publicId: req.file.filename });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed', error: err.message });
  }
});

// Files upload using local storage
router.post('/files', protect, upload.array('files', 5), (req, res) => {
  const files = req.files.map(f => ({ url: `/uploads/${f.filename}`, name: f.originalname }));
  res.json({ success: true, files });
});

module.exports = router;
