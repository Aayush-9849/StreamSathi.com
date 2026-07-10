const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const VisitLog = require('../models/VisitLog');
const User = require('../models/User');

// Helper to verify admin token
async function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    req.admin = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// POST /api/analytics/track — Track a visitor page view (Public)
router.post('/track', async (req, res) => {
  try {
    const { visitorId, path, referrer, userAgent, deviceType } = req.body;
    if (!visitorId) {
      return res.status(400).json({ success: false, message: 'visitorId required' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const cleanPath = (path || '/').split('?')[0];

    // Throttle duplicate logs from the exact same visitorId on the same path within 3 minutes
    const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000);
    const recentDuplicate = await VisitLog.findOne({
      visitorId,
      path: cleanPath,
      timestamp: { $gte: threeMinsAgo },
    });

    if (recentDuplicate) {
      // Update timestamp on existing recent view
      recentDuplicate.timestamp = new Date();
      await recentDuplicate.save();
      return res.json({ success: true, logged: false, message: 'Updated recent timestamp' });
    }

    await VisitLog.create({
      visitorId,
      path: cleanPath,
      referrer: referrer || 'Direct',
      userAgent: userAgent || 'Unknown',
      deviceType: deviceType || 'Desktop',
      ip: String(ip).slice(0, 45),
      timestamp: new Date(),
    });

    return res.json({ success: true, logged: true });
  } catch (err) {
    console.error('Track error:', err.message);
    return res.status(500).json({ success: false });
  }
});

// GET /api/analytics/summary — Get full analytics summary for Admin Control Cockpit
router.get('/summary', verifyAdmin, async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOf7DaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalVisits,
      uniqueVisitorsList,
      todayVisits,
      todayUniqueList,
      deviceStats,
      topPages,
      recentVisits,
    ] = await Promise.all([
      VisitLog.countDocuments(),
      VisitLog.distinct('visitorId'),
      VisitLog.countDocuments({ timestamp: { $gte: startOfToday } }),
      VisitLog.distinct('visitorId', { timestamp: { $gte: startOfToday } }),
      VisitLog.aggregate([
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      ]),
      VisitLog.aggregate([
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      VisitLog.find()
        .sort({ timestamp: -1 })
        .limit(60)
        .select('visitorId path referrer deviceType userAgent timestamp ip')
        .lean(),
    ]);

    // Format device breakdown
    const deviceBreakdown = { Desktop: 0, Mobile: 0, Tablet: 0, Unknown: 0 };
    deviceStats.forEach((d) => {
      if (deviceBreakdown[d._id] !== undefined) {
        deviceBreakdown[d._id] = d.count;
      } else {
        deviceBreakdown.Unknown = (deviceBreakdown.Unknown || 0) + d.count;
      }
    });

    return res.json({
      success: true,
      data: {
        totalVisits,
        uniqueVisitors: uniqueVisitorsList.length,
        todayVisits,
        todayUniqueVisitors: todayUniqueList.length,
        deviceBreakdown,
        topPages: topPages.map((p) => ({ path: p._id || '/', count: p.count })),
        recentVisits,
      },
    });
  } catch (err) {
    console.error('Analytics summary error:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching analytics' });
  }
});

// DELETE /api/analytics/clear — Clear old analytics logs (Admin only)
router.delete('/clear', verifyAdmin, async (req, res) => {
  try {
    await VisitLog.deleteMany({});
    return res.json({ success: true, message: 'All analytics logs cleared' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error clearing logs' });
  }
});

module.exports = router;
