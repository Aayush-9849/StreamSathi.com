const mongoose = require('mongoose');

const visitLogSchema = new mongoose.Schema({
  visitorId: {
    type: String,
    required: true,
    index: true,
  },
  path: {
    type: String,
    default: '/',
  },
  referrer: {
    type: String,
    default: 'Direct',
  },
  userAgent: {
    type: String,
    default: 'Unknown',
  },
  deviceType: {
    type: String,
    enum: ['Desktop', 'Mobile', 'Tablet', 'Unknown'],
    default: 'Desktop',
  },
  ip: {
    type: String,
    default: '',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model('VisitLog', visitLogSchema);
