const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Read JWT token from HTTP-only cookie or Authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no session token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-passwordHash');
    if (!req.user) {
      return res.status(404).json({ success: false, message: 'User session has expired or user was deleted.' });
    }
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token.' });
  }
};

const verifiedOnly = (req, res, next) => {
  next();
};

module.exports = { protect, verifiedOnly };
