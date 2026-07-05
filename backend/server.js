require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const planRoutes = require('./routes/plans');
const settingRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS setup to support local dashboard sessions and HTTP cookies
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve Multer uploaded receipt images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/settings', settingRoutes);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'StreamSathi Backend running smoothly.' });
});

// Connect database and launch
const start = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/streamsathi';
    await mongoose.connect(mongoUri);
    console.log('Successfully connected to MongoDB.');

    // Pre-seed default Admin User if not exists
    const User = require('./models/User');
    const adminEmail = 'kumaryada263@gmail.com';
    const adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      const bcrypt = require('bcrypt');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('12345', salt);
      await User.create({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash,
        whatsApp: '+977-9800000000',
        isVerified: true, // Mark verified directly
      });
      console.log(`Pre-seeded Admin credentials created successfully: ${adminEmail}`);
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
      console.log('Pre-seeded default eSewa QR code path.');
    }
    const khaltiQr = await Setting.findOne({ key: 'khalti_qr' });
    if (!khaltiQr) {
      await Setting.create({ key: 'khalti_qr', value: '/images/khalti_qr.jpg' });
      console.log('Pre-seeded default Khalti QR code path.');
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
