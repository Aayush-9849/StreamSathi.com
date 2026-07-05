const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Setting = require('../models/Setting');
const { protect } = require('../middleware/auth');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'qr-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Only QR code image files (jpeg, jpg, png, webp) are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
});

// @desc    Get current eSewa and Khalti QR code values
// @route   GET /api/settings
// @access  Public
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find();
    // Reduce array to simple key-value dictionary for easy consumption
    const config = {};
    settings.forEach((s) => {
      config[s.key] = s.value;
    });
    return res.status(200).json({ success: true, settings: config });
  } catch (error) {
    console.error('Fetch settings error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving settings.' });
  }
});

// @desc    Upload new QR code for eSewa or Khalti
// @route   POST /api/settings/upload-qr
// @access  Private (Admin Only)
router.post('/upload-qr', protect, upload.single('qrImage'), async (req, res) => {
  const { key } = req.body;

  try {
    // Validate admin privileges
    const isAdmin = req.user.email === 'kumaryada263@gmail.com';
    if (!isAdmin) {
      // Remove uploaded file if not admin to prevent orphan storage files
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    }

    if (!key || !['esewa_qr', 'khalti_qr'].includes(key)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, message: 'Please select a valid merchant (esewa_qr or khalti_qr).' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a QR code image.' });
    }

    const valuePath = `/uploads/${req.file.filename}`;

    // Update or insert setting key
    let setting = await Setting.findOne({ key });
    if (setting) {
      // Optional: Delete old custom QR file if it was custom uploaded (not a pre-seeded static path)
      if (setting.value.startsWith('/uploads/')) {
        const oldFilePath = path.join(__dirname, '..', setting.value);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
          } catch (err) {
            console.error('Failed to delete old QR image:', err);
          }
        }
      }
      setting.value = valuePath;
      setting.updatedAt = Date.now();
      await setting.save();
    } else {
      setting = await Setting.create({ key, value: valuePath });
    }

    console.log(`Merchant QR Code updated [${key}]: ${valuePath}`);

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${key === 'esewa_qr' ? 'eSewa' : 'Khalti'} QR code representation.`,
      value: valuePath,
    });
  } catch (error) {
    console.error('Upload QR error:', error);
    // Cleanup on generic error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error uploading QR code.' });
  }
});

module.exports = router;
