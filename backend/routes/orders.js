const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Order = require('../models/Order');
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
  cb(new Error('Only receipt image files (jpeg, jpg, png, webp) are allowed!'));
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper to auto-expire Active orders
const autoExpireOrders = async () => {
  try {
    const now = new Date();
    const expiredOrders = await Order.find({
      status: 'Active',
      expiresAt: { $lt: now }
    });

    if (expiredOrders.length > 0) {
      for (const order of expiredOrders) {
        order.status = 'Deactivated';
        await order.save();
        console.log(`Auto-deactivated expired subscription: Order ID ${order._id}`);
      }
    }
  } catch (err) {
    console.error('Error auto-expiring subscriptions:', err);
  }
};

// @desc    Place a subscription order (screenshot required)
// @route   POST /api/orders/place-order
// @access  Private (Verified users only)
router.post('/place-order', protect, verifiedOnly, upload.single('screenshot'), async (req, res) => {
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
      return res.status(400).json({ success: false, message: 'All text fields are required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a payment success receipt screenshot.' });
    }

    // Save relative URL path for serving
    const paymentScreenshotUrl = `/uploads/${req.file.filename}`;

    const order = await Order.create({
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
    const isAdmin = req.user.email === 'kumaryada263@gmail.com';
    if (!isAdmin) {
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
    const isAdmin = req.user.email === 'kumaryada263@gmail.com';
    if (!isAdmin) {
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
      order.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 Days expiration window
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
