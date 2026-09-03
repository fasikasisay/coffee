const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'products');

// Create uploads/products folder automatically
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
    const uniqueName =
      `product-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    cb(null, uniqueName + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(
      new Error('Only JPG, PNG, and WebP images are allowed'),
      false
    );
  }

  cb(null, true);
};

const uploadProductImage = multer({
  storage,
  fileFilter,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = uploadProductImage;