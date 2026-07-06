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
  const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
  err.message = 'Only QR code image files (jpeg, jpg, png, webp) are allowed!';
  cb(err);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
});

// Helper: wrap multer to catch MulterError inside route
const uploadQr = (req, res, next) => {
  upload.single('qrImage')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File type not allowed.' });
    }
    next();
  });
};

// @desc    Get current eSewa and Khalti QR code values
// @route   GET /api/settings
// @access  Public
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find();
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
router.post('/upload-qr', protect, uploadQr, async (req, res) => {
  const { key } = req.body;

  try {
    // Validate admin privileges using isAdmin field
    if (!req.user.isAdmin) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    }

    if (!key || !['esewa_qr', 'khalti_qr'].includes(key)) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Please select a valid merchant (esewa_qr or khalti_qr).' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a QR code image.' });
    }

    const fileBuffer = await fs.promises.readFile(req.file.path);
    const base64Image = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
    await fs.promises.unlink(req.file.path).catch(() => {});

    let setting = await Setting.findOne({ key });
    if (setting) {
      // Delete old custom QR file asynchronously if it was previously uploaded as a disk file
      if (setting.value && setting.value.startsWith('/uploads/')) {
        const oldFilePath = path.join(__dirname, '..', setting.value);
        await fs.promises.unlink(oldFilePath).catch(() => {});
      }
      setting.value = base64Image;
      setting.updatedAt = Date.now();
      await setting.save();
    } else {
      setting = await Setting.create({ key, value: base64Image });
    }

    console.log(`Merchant QR Code updated [${key}] as permanent Base64 Data URI`);

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${key === 'esewa_qr' ? 'eSewa' : 'Khalti'} QR code representation.`,
      value: base64Image,
    });
  } catch (error) {
    console.error('Upload QR error:', error);
    if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(500).json({ success: false, message: error.message || 'Server error uploading QR code.' });
  }
});

module.exports = router;
