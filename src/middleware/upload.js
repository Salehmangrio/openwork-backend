/**
 * upload.js
 * Cloudinary image upload middleware using multer
 */

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Cloudinary storage for profile images
const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'openwork/profiles', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Allowed file formats
    public_id: (req, file) => {
      // Generate unique filename: user_id_timestamp
      const userId = req.user?._id || 'unknown';
      const timestamp = Date.now();
      return `${userId}_${timestamp}`;
    },
    transformation: [
      { width: 500, height: 500, crop: 'limit' }, // Resize to max 500x500
      { quality: 'auto' }, // Auto optimize quality
    ],
  },
});

// Configure Cloudinary storage for offer thumbnails
const offerStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'openwork/offers', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], // Allowed file formats
    public_id: (req, file) => {
      // Generate unique filename: offer_timestamp
      const timestamp = Date.now();
      return `offer_${timestamp}`;
    },
    transformation: [
      { width: 800, height: 600, crop: 'limit' }, // Resize to max 800x600
      { quality: 'auto' }, // Auto optimize quality
    ],
  },
});

// Create multer instance for profile images
const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.'), false);
    }
  },
});

// Create multer instance for offer thumbnails
const offerUpload = multer({
  storage: offerStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, JPG, PNG, and WebP are allowed.'), false);
    }
  },
});

// Export upload middleware for single file upload with 'profileImage' field name
exports.uploadProfileImage = profileUpload.single('profileImage');

// Export upload middleware for single file upload with 'avatar' field name (for client compatibility)
exports.uploadAvatar = profileUpload.single('avatar');

// Export upload middleware for offer thumbnail
exports.uploadOfferThumbnail = offerUpload.single('offerThumbnail');

// Export Cloudinary instance for direct use if needed
exports.cloudinary = cloudinary;
