const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  platform: {
    type: String,
    enum: ['Netflix', 'Amazon Prime', 'SonyLIV', 'Zee5'],
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  details: {
    type: String,
    required: true,
    trim: true,
  },
  popular: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Plan', planSchema);
