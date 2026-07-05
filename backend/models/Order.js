const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  platform: {
    type: String,
    enum: ['Netflix', 'Amazon Prime', 'SonyLIV', 'Zee5'],
    required: true,
  },
  planSelected: {
    type: String,
    enum: ['Mobile', 'Basic', 'Standard', 'Premium UHD'],
    required: true,
  },
  amountPaidNPR: {
    type: Number,
    required: true,
  },
  targetStreamingGmail: {
    type: String,
    required: true,
    trim: true,
  },
  targetStreamingPassword: {
    type: String,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['eSewa', 'Khalti'],
    required: true,
  },
  paymentScreenshotUrl: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Active', 'Deactivated', 'Cancelled'],
    default: 'Pending',
  },
  activatedAt: {
    type: Date,
  },
  expiresAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', orderSchema);
