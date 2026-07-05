const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  whatsApp: {
    type: String,
    required: true,
    trim: true,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otpCode: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  emailStatus: {
    type: String,
    enum: ['sent', 'failed'],
  },
  emailMessageId: {
    type: String,
  },
  emailError: {
    type: String,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
