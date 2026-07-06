const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { getCookieOptions } = require('../utils/security');

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// Module-level cached transporter (created once, not per-request)
let _cachedTransporter = null;
const getTransporter = () => {
  if (_cachedTransporter) return _cachedTransporter;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Use explicit SMTP config with IPv4 forced — Render free tier blocks IPv6 SMTP
    _cachedTransporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // STARTTLS
      family: 4,     // Force IPv4 — prevents ENETUNREACH on Render
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: true,
      },
    });
    return _cachedTransporter;
  }
  console.warn('EMAIL_USER/EMAIL_PASS not set. OTP will only be logged to console.');
  return null;
};

// OTP email HTML template
const buildOtpHtml = (otpCode, title, subtitle) => `
  <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 560px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
    <div style="background: linear-gradient(135deg, #4F46E5, #7C3AED); border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px;">
      <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">StreamSathi</h1>
      <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px;">${subtitle}</p>
    </div>
    <div style="background: white; border-radius: 10px; padding: 28px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <p style="color: #374151; margin: 0 0 20px; font-size: 15px;">${title}</p>
      <div style="background: #f1f5f9; border: 2px dashed #c7d2fe; border-radius: 10px; padding: 18px; display: inline-block; margin: 0 auto 20px;">
        <span style="font-size: 36px; font-weight: 900; letter-spacing: 10px; color: #4F46E5; font-family: monospace;">${otpCode}</span>
      </div>
      <p style="color: #ef4444; font-size: 13px; margin: 0;">⏱ This code expires in <strong>5 minutes</strong>. Do not share it with anyone.</p>
    </div>
    <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 20px;">
      If you did not request this, you can safely ignore this email.
    </p>
  </div>
`;

// Helper: send OTP email and update user emailStatus in DB
const sendOtpEmail = async (user, otpCode, subject, title, subtitle) => {
  const transporter = getTransporter();
  if (!transporter) return;

  const mailOptions = {
    from: `"StreamSathi" <${process.env.EMAIL_USER}>`,
    to: user.email,
    subject,
    html: buildOtpHtml(otpCode, title, subtitle),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${user.email}: ${info.messageId}`);
    await User.updateOne({ _id: user._id }, {
      $set: { emailStatus: 'sent', emailMessageId: info.messageId, emailError: null },
    });
  } catch (mailErr) {
    console.error(`OTP email failed for ${user.email}:`, mailErr.message);
    // Reset cached transporter on auth failure so it retries on next request
    if (mailErr.code === 'EAUTH') _cachedTransporter = null;
    await User.updateOne({ _id: user._id }, {
      $set: { emailStatus: 'failed', emailError: mailErr.message },
    });
  }
};

// @desc    Register a new user
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

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate cryptographically secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const user = await User.create({
      name,
      email,
      passwordHash,
      whatsApp,
      isVerified: false,
      otpCode,
      otpExpires,
    });

    // Log OTP to console (backup for debugging)
    console.log(`\n========================================`);
    console.log(`OTP for ${email}: ${otpCode}`);
    console.log(`========================================\n`);

    // Send OTP email asynchronously (does not block response)
    sendOtpEmail(
      user,
      otpCode,
      'StreamSathi — Verify Your Email Address',
      'Enter the 6-digit code below to activate your StreamSathi account:',
      'Email Verification'
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful! A 6-digit OTP has been sent to your email address.',
      email,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Server error during user registration.' });
  }
});

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { otpCode } = req.body;
  const email = String(req.body.email || '').trim().toLowerCase();

  try {
    if (!email || !otpCode) {
      return res.status(400).json({ success: false, message: 'Please provide email and the 6-digit OTP.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified. Please log in.' });
    }

    // Check expiry FIRST
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Your OTP has expired. Please request a new one.' });
    }

    // Then check code
    if (user.otpCode !== String(otpCode)) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code. Please check and try again.' });
    }

    // Mark verified, clear OTP fields
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user._id);
    res.cookie('token', token, getCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully! Welcome to StreamSathi.',
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
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error during OTP verification.' });
  }
});

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
router.post('/resend-otp', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide your email address.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified.' });
    }

    // Server-side cooldown — 60 seconds between OTP requests
    if (user.otpExpires) {
      const otpAge = Date.now() - (user.otpExpires.getTime() - 5 * 60 * 1000);
      if (otpAge < 60 * 1000) {
        return res.status(429).json({ success: false, message: 'Please wait a minute before requesting another OTP.' });
      }
    }

    // Generate fresh OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    user.otpCode = otpCode;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    console.log(`\n========================================`);
    console.log(`RESEND OTP for ${email}: ${otpCode}`);
    console.log(`========================================\n`);

    // Send email asynchronously
    sendOtpEmail(
      user,
      otpCode,
      'StreamSathi — New Activation OTP',
      'You requested a new OTP. Enter the code below to activate your account:',
      'OTP Resend'
    );

    return res.status(200).json({
      success: true,
      message: 'A new OTP has been sent to your email. Please check your inbox and spam folder.',
      email,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error during OTP resend.' });
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

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Your account email is not verified. Please verify your email first.',
        notVerified: true,
        email: user.email,
      });
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
