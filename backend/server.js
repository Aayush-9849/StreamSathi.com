require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// --- Startup safety checks ---
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET environment variable is not set. Shutting down.');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const planRoutes = require('./routes/plans');
const settingRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5001;

// Security headers (helmet)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — allow Vercel frontend and local dev
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'https://stream-sathi-com.vercel.app',
  'http://localhost:3000',
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Body size limits to prevent payload attacks
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Global rate limiter — 120 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
});
app.use(globalLimiter);

// Strict rate limiter for auth endpoints — 15 requests per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts from this IP. Please wait 15 minutes before trying again.' },
});

// Serve Multer uploaded receipt images (static)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/settings', settingRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'StreamSathi Backend running smoothly.' });
});

// Global error handler (must be last middleware, 4 params)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message,
  });
});

// Connect database and launch
const start = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsathi';
    await mongoose.connect(mongoUri);
    console.log('Successfully connected to MongoDB.');

    // Pre-seed default Admin User if not exists
    const User = require('./models/User');
    const adminEmail = process.env.ADMIN_EMAIL || 'kumaryada263@gmail.com';
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const bcrypt = require('bcrypt');
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) {
        console.warn('WARNING: ADMIN_PASSWORD env var not set. Admin account NOT pre-seeded.');
      } else {
        const salt = await bcrypt.genSalt(12);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        await User.create({
          name: 'System Administrator',
          email: adminEmail,
          passwordHash,
          whatsApp: '+977-9800000000',
          isVerified: true,
          isAdmin: true,
        });
        console.log(`Pre-seeded Admin account: ${adminEmail}`);
      }
    } else if (!adminUser.isAdmin) {
      // Backfill isAdmin flag on existing admin account
      await User.updateOne({ email: adminEmail }, { $set: { isAdmin: true } });
    }

    // Pre-seed default Pricing Plans if not exists
    const Plan = require('./models/Plan');
    const plansCount = await Plan.countDocuments();
    if (plansCount === 0) {
      const defaultPlans = [];
      const platforms = ['Netflix', 'Amazon Prime', 'SonyLIV', 'Zee5'];
      platforms.forEach((platform) => {
        const isNetflix = platform === 'Netflix';
        defaultPlans.push(
          { platform, name: 'Mobile', price: isNetflix ? 150 : 100, details: '1 Screen, Mobile only (SD)', popular: false },
          { platform, name: 'Basic', price: isNetflix ? 350 : 200, details: '1 Screen, All devices (720p)', popular: false },
          { platform, name: 'Standard', price: isNetflix ? 800 : 350, details: '2 Screens, All devices (1080p)', popular: false },
          { platform, name: 'Premium UHD', price: isNetflix ? 1100 : 500, details: '4 Screens, All devices (4K)', popular: true }
        );
      });
      await Plan.insertMany(defaultPlans);
      console.log('Pre-seeded default subscription pricing plans.');
    }

    // Pre-seed default Payment QRs if not exists
    const Setting = require('./models/Setting');
    const esewaQr = await Setting.findOne({ key: 'esewa_qr' });
    if (!esewaQr) {
      await Setting.create({ key: 'esewa_qr', value: '/images/esewa_qr.jpg' });
    }
    const khaltiQr = await Setting.findOne({ key: 'khalti_qr' });
    if (!khaltiQr) {
      await Setting.create({ key: 'khalti_qr', value: '/images/khalti_qr.jpg' });
    }

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

start();
