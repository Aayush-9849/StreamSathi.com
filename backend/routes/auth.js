const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Module-level cached transporter (created once, not per-request)
let _cachedTransporter = null;
const getTransporter = async () => {
  if (_cachedTransporter) return _cachedTransporter;

  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    _cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    return _cachedTransporter;
  }
  // No email configured — log OTP to console only
  console.warn('EMAIL_USER/EMAIL_PASS not set. OTP will only be logged to console.');
  return null;
};

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const { name, email, password, whatsApp } = req.body;

  try {
    if (!name || !email || !password || !whatsApp) {
      return res.status(400).json({ success: false, message: 'All text fields (name, email, password, whatsApp) are required.' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    // Password minimum length
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
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
      whatsApp,
      isVerified: false,
      otpCode,
      otpExpires,
    });

    // Logging OTP to terminal console
    console.log('\n======================================');
    console.log(`NEW REGISTRATION: ${email}`);
    console.log(`ACTIVE 6-DIGIT OTP: ${otpCode}`);
    console.log('======================================\n');

    // Attempt email delivery
    const transporter = await getTransporter();
    if (transporter) {
      const mailOptions = {
        from: `"StreamSathi Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'StreamSathi - Email Activation OTP Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4F46E5; text-align: center;">Welcome to StreamSathi!</h2>
            <p>Thank you for registering. Please enter the following 6-digit activation code on the verify page to activate your account.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1f2937; margin: 20px 0;">
              ${otpCode}
            </div>
            <p style="color: #ef4444; font-size: 13px;">This OTP will expire in 5 minutes.</p>
          </div>
        `,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Nodemailer OTP email sent successfully:', info.messageId);
        await User.updateOne({ _id: user._id }, {
          $set: { emailStatus: 'sent', emailMessageId: info.messageId }
        });
      } catch (mailErr) {
        console.error('Nodemailer OTP sending error:', mailErr.message);
        await User.updateOne({ _id: user._id }, {
          $set: { emailStatus: 'failed', emailError: mailErr.message }
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Registration successful! A 6-digit OTP code has been sent to your email address.',
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
  const { email, otpCode } = req.body;

  try {
    if (!email || !otpCode) {
      return res.status(400).json({ success: false, message: 'Please provide email and the 6-digit OTP.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified.' });
    }

    // Check OTP expiry FIRST before comparing code
    if (!user.otpExpires || user.otpExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'The OTP code has expired. Please request a new one.' });
    }

    if (user.otpCode !== otpCode) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code entered.' });
    }

    // Verify user
    user.isVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user._id);

    // Set cookie (sameSite=none required for cross-origin Vercel <-> Render)
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Account successfully verified! Logged in.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        whatsApp: user.whatsApp,
        isVerified: user.isVerified,
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
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide email.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ success: false, message: 'This account is already verified.' });
    }

    // Check Cooldown (e.g., 60 seconds)
    if (user.otpExpires && (new Date(user.otpExpires.getTime() - 4 * 60 * 1000) > new Date(Date.now() - 60000))) {
      return res.status(429).json({ success: false, message: 'Please wait a minute before requesting another OTP.' });
    }

    // Generate cryptographically secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    user.otpCode = otpCode;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Logging OTP to terminal console
    console.log('\n======================================');
    console.log(`RESEND OTP FOR: ${email}`);
    console.log(`ACTIVE 6-DIGIT OTP: ${otpCode}`);
    console.log('======================================\n');

    // Attempt email delivery
    const transporter = await getTransporter();
    if (transporter) {
      const mailOptions = {
        from: `"StreamSathi Portal" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'StreamSathi - New Activation OTP Code',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4F46E5; text-align: center;">StreamSathi OTP Resend</h2>
            <p>A new 6-digit OTP has been sent to your email address. Please enter it to activate your account.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1f2937; margin: 20px 0;">
              ${otpCode}
            </div>
            <p style="color: #ef4444; font-size: 13px;">This OTP will expire in 5 minutes.</p>
          </div>
        `,
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Nodemailer resend OTP email sent successfully:', info.messageId);
        await User.updateOne({ _id: user._id }, {
          $set: { emailStatus: 'sent', emailMessageId: info.messageId }
        });
      } catch (mailErr) {
        console.error('Nodemailer resend OTP sending error:', mailErr.message);
        await User.updateOne({ _id: user._id }, {
          $set: { emailStatus: 'failed', emailError: mailErr.message }
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'A new 6-digit OTP code has been successfully sent to your Gmail address.',
      email,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({ success: false, message: 'Server error during resending OTP.' });
  }
});


// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid credentials.' });
    }

    // Block unverified users from logging in
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

    // Set HTTP-only cookie (sameSite=none required for cross-origin Vercel <-> Render)
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        whatsApp: user.whatsApp,
        isVerified: user.isVerified,
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
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
router.post('/logout', protect, (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: true, sameSite: 'none' });
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
