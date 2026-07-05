const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
const Plan = require('../models/Plan');
const { protect, verifiedOnly } = require('../middleware/auth');

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter (only image screenshots allowed)
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const mimetype = allowedTypes.test(file.mimetype);
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname);
  err.message = 'Only receipt image files (jpeg, jpg, png, webp) are allowed!';
  cb(err);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper: wrap multer to handle MulterError in route try/catch
const uploadSingle = (fieldName) => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.message || 'File upload error.' });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message || 'File type not allowed.' });
    }
    next();
  });
};

// Helper: auto-expire Active orders using efficient bulk updateMany
const autoExpireOrders = async () => {
  try {
    const now = new Date();
    const result = await Order.updateMany(
      { status: 'Active', expiresAt: { $lt: now } },
      { $set: { status: 'Deactivated' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`Auto-deactivated ${result.modifiedCount} expired subscriptions.`);
    }
  } catch (err) {
    console.error('Error auto-expiring subscriptions:', err);
  }
};

// @desc    Place a subscription order (screenshot required)
// @route   POST /api/orders/place-order
// @access  Private (Verified users only)
router.post('/place-order', protect, verifiedOnly, uploadSingle('screenshot'), async (req, res) => {
  try {
    const {
      platform,
      planSelected,
      amountPaidNPR,
      targetStreamingGmail,
      targetStreamingPassword,
      paymentMethod,
    } = req.body;

    if (
      !platform ||
      !planSelected ||
      !amountPaidNPR ||
      !targetStreamingGmail ||
      !targetStreamingPassword ||
      !paymentMethod
    ) {
      if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'All text fields are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a payment success receipt screenshot.' });
    }

    // Validate submitted amount against actual plan price in DB
    const plan = await Plan.findOne({ platform, name: planSelected });
    if (!plan) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, message: 'Selected plan not found. Please go back and choose a valid plan.' });
    }
    if (Number(amountPaidNPR) < plan.price) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: `Amount mismatch. Expected Rs. ${plan.price} for ${platform} ${planSelected}.`,
      });
    }

    // Check for an existing pending/active order to prevent duplicates
    const existingOrder = await Order.findOne({
      userId: req.user._id,
      platform,
      status: { $in: ['Pending', 'In Progress', 'Active'] },
    });
    if (existingOrder) {
      await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({
        success: false,
        message: `You already have an active or pending ${platform} subscription order.`,
      });
    }

    const paymentScreenshotUrl = `/uploads/${req.file.filename}`;

    let order;
    try {
      order = await Order.create({
        userId: req.user._id,
        platform,
        planSelected,
        amountPaidNPR: Number(amountPaidNPR),
        targetStreamingGmail,
        targetStreamingPassword,
        paymentMethod,
        paymentScreenshotUrl,
        status: 'Pending',
      });
    } catch (dbErr) {
      // Cleanup uploaded file if DB save fails
      await fs.promises.unlink(req.file.path).catch(() => {});
      throw dbErr;
    }

    return res.status(201).json({
      success: true,
      message: 'Subscription order placed successfully! Awaiting verification.',
      order,
    });
  } catch (error) {
    console.error('Place order error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error during order checkout.' });
  }
});

// @desc    Get current user's order history
// @route   GET /api/orders/my-orders
// @access  Private
router.get('/my-orders', protect, async (req, res) => {
  try {
    await autoExpireOrders();
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Fetch my-orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving your order history.' });
  }
});

// @desc    Get all global orders (Admin Only)
// @route   GET /api/orders/admin/all
// @access  Private (Admin Only)
router.get('/admin/all', protect, async (req, res) => {
  try {
    await autoExpireOrders();
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator session required.' });
    }

    const orders = await Order.find()
      .populate('userId', 'name email whatsApp')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error('Fetch global orders error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving administration records.' });
  }
});

// @desc    Update order status (Admin Only)
// @route   PUT /api/orders/admin/update-status/:id
// @access  Private (Admin Only)
router.put('/admin/update-status/:id', protect, async (req, res) => {
  const { status } = req.body;

  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator session required.' });
    }

    if (!['Pending', 'In Progress', 'Active', 'Deactivated', 'Cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid order status selected.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Activation order not found.' });
    }

    order.status = status;
    if (status === 'Active') {
      order.activatedAt = new Date();
      order.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days
    }
    await order.save();

    return res.status(200).json({
      success: true,
      message: `Order status updated to ${status}.`,
      order,
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating order status.' });
  }
});

module.exports = router;
