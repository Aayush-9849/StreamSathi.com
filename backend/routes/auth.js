const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
const _originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  } else if (typeof options === 'number') {
    options = { family: options };
  } else if (!options) {
    options = {};
  }
  options.family = 4;
  return _originalLookup(hostname, options, callback);
};
const User = require('../models/User');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { getCookieOptions } = require('../utils/security');

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Force IPv4 Lookup helper for Render containers (bypasses OS getaddrinfo IPv6 ordering)
const forceIPv4Lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  dns.resolve4(hostname, (err, addresses) => {
    if (err || !addresses || !addresses[0]) {
      return dns.lookup(hostname, { ...options, family: 4 }, callback);
    }
    callback(null, addresses[0], 4);
  });
};

// Cached Transporter for Admin Emails
let _cachedTransporter = null;

/**
 * Resolve smtp.gmail.com to an IPv4 address ONCE and create the transporter
 * pointed at that IP. This completely bypasses nodemailer's internal dual-stack
 * DNS resolver which caches both IPv4+IPv6 and can fail on Render (ENETUNREACH).
 */
const getTransporter = async () => {
  if (_cachedTransporter) return _cachedTransporter;
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;

  // Resolve to IPv4 address using our forceIPv4Lookup helper
  const smtpIp = await new Promise((resolve, reject) => {
    forceIPv4Lookup('smtp.gmail.com', {}, (err, address) => {
      if (err) return reject(err);
      resolve(address);
    });
  });

  _cachedTransporter = nodemailer.createTransport({
    host: smtpIp,                    // Connect directly to resolved IPv4 address
    port: 465,
    secure: true,                    // Use direct TLS (port 465) — more reliable than STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      servername: 'smtp.gmail.com',  // Required for TLS certificate validation when using IP
      rejectUnauthorized: true,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
  });
  return _cachedTransporter;
};

const getEmailConfigStatus = async () => {
  const configured = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const maskedUser = process.env.EMAIL_USER
    ? process.env.EMAIL_USER.replace(/(^.).*(@.*$)/, '$1***$2')
    : null;

  if (!configured) {
    return {
      configured,
      verified: false,
      emailUser: maskedUser,
      message: 'EMAIL_USER and EMAIL_PASS must be set on the backend server.',
    };
  }

  try {
    const transporter = await getTransporter();
    await transporter.verify();
    return {
      configured,
      verified: true,
      emailUser: maskedUser,
      message: 'Email sender is configured and Gmail SMTP accepted the credentials.',
    };
  } catch (error) {
    _cachedTransporter = null;
    return {
      configured,
      verified: false,
      emailUser: maskedUser,
      message: error.message,
      code: error.code,
    };
  }
};

// Generate JWT Helper
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @desc    Register a new user (no OTP — direct login)
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const password = req.body.password;
  const whatsApp = String(req.body.whatsApp || '').trim();
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

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
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
      .select('name email whatsApp isVerified createdAt emailStatus emailMessageId emailError')
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

// @desc    Check admin email sender configuration
// @route   GET /api/auth/admin/email-status
// @access  Private (Admin Only)
router.get('/admin/email-status', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const status = await getEmailConfigStatus();
    return res.status(200).json({ success: true, ...status });
  } catch (error) {
    console.error('Email status check error:', error);
    return res.status(500).json({ success: false, message: 'Server error checking email sender.' });
  }
});

// @desc    Admin send custom email to any customer
// @route   POST /api/auth/admin/send-email
// @access  Private (Admin Only)
router.post('/admin/send-email', protect, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const { recipientEmail, subject, title, message } = req.body;
    if (!recipientEmail || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Recipient email, subject, and message are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(String(recipientEmail).trim())) {
      return res.status(400).json({ success: false, message: 'Please provide a valid recipient email address.' });
    }

    const transporter = await getTransporter();
    if (!transporter) {
      return res.status(500).json({ success: false, message: 'Email server is not configured (missing EMAIL_USER or EMAIL_PASS).' });
    }

    const formattedMessage = String(message)
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p style="color: #374151; margin: 0 0 16px; font-size: 15px; line-height: 1.6; text-align: left;">${escapeHtml(p)}</p>`)
      .join('');
    const safeTitle = escapeHtml(title);
    const safeRecipientEmail = escapeHtml(recipientEmail);

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 32px; border-radius: 12px;">
        <div style="background: linear-gradient(135deg, #2563eb, #06b6d4); border-radius: 10px; padding: 24px; text-align: center; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(37,99,235,0.2);">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800;">StreamSathi</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 6px 0 0; font-size: 13px; font-weight: 500;">Secure Activation Platform</p>
        </div>
        <div style="background: white; border-radius: 10px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          ${safeTitle ? `<h2 style="color: #111827; margin: 0 0 20px; font-size: 20px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px;">${safeTitle}</h2>` : ''}
          ${formattedMessage}
          <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0 0 4px; font-weight: 600;">Best Regards,</p>
            <p style="color: #2563eb; font-size: 15px; font-weight: 700; margin: 0;">The StreamSathi Team</p>
          </div>
        </div>
        <div style="text-align: center; margin-top: 24px;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} StreamSathi Nepal. All rights reserved.</p>
          <p style="color: #94a3b8; font-size: 11px; margin: 6px 0 0;">This email was sent to ${safeRecipientEmail} from StreamSathi customer support.</p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: '"StreamSathi Support" <' + process.env.EMAIL_USER + '>',
      to: String(recipientEmail).trim(),
      subject: String(subject).trim(),
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Admin email sent to ' + recipientEmail + ': ' + info.messageId);

    await User.findOneAndUpdate(
      { email: String(recipientEmail).trim().toLowerCase() },
      { emailStatus: 'sent', emailMessageId: info.messageId, $unset: { emailError: 1 } }
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully to ' + recipientEmail + '!',
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Admin send email error:', error);
    _cachedTransporter = null; // Clear cached transporter on any error
    await User.findOneAndUpdate(
      { email: String(req.body.recipientEmail || '').trim().toLowerCase() },
      { emailStatus: 'failed', emailError: error.message }
    ).catch(() => {});
    return res.status(500).json({ success: false, message: 'Failed to send email: ' + error.message });
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
