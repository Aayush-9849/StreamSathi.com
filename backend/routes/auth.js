const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { getCookieOptions } = require('../utils/security');

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user (no OTP — direct login)
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, password, whatsApp } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();

  try {
    if (!name || !email || !password || !whatsApp) {
      return res.status(400).json({ success: false, message: 'All fields (name, email, password, whatsApp) are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account is already registered with this email address.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      passwordHash,
      whatsApp,
      isVerified: true, // No OTP — verified immediately
    });

    const token = generateToken(user._id);
    res.cookie('token', token, getCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to StreamSathi.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        whatsApp: user.whatsApp,
        isVerified: true,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during user registration.' });
  }
});

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const { password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Auto-verify any legacy unverified accounts on login
    if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        whatsApp: user.whatsApp,
        isVerified: user.isVerified,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// @desc    Get Current User Profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
});

// @desc    Get all non-admin customers (Admin Only)
// @route   GET /api/auth/admin/customers
// @access  Private (Admin Only)
router.get('/admin/customers', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const customers = await User.find({ isAdmin: { $ne: true } })
      .select('name email whatsApp isVerified createdAt')
      .sort({ createdAt: -1 });

    const orderCounts = await Order.aggregate([
      { $group: { _id: '$userId', totalOrders: { $sum: 1 } } },
    ]);
    const countsByUserId = new Map(orderCounts.map((item) => [String(item._id), item.totalOrders]));

    return res.status(200).json({
      success: true,
      totalCustomers: customers.length,
      customers: customers.map((customer) => ({
        ...customer.toObject(),
        totalOrders: countsByUserId.get(String(customer._id)) || 0,
      })),
    });
  } catch (error) {
    console.error('Fetch customers error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving customers.' });
  }
});

// @desc    Delete current customer account
// @route   DELETE /api/auth/me
// @access  Private
router.delete('/me', protect, async (req, res) => {
  try {
    if (req.user.isAdmin) {
      return res.status(400).json({ success: false, message: 'Admin accounts cannot be deleted from the customer dashboard.' });
    }
    await Order.deleteMany({ userId: req.user._id });
    await User.deleteOne({ _id: req.user._id });
    const { maxAge, ...cookieOptions } = getCookieOptions();
    res.clearCookie('token', cookieOptions);
    return res.status(200).json({ success: true, message: 'Your account and order history have been deleted.' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting account.' });
  }
});

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  const { maxAge, ...cookieOptions } = getCookieOptions();
  res.clearCookie('token', cookieOptions);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
