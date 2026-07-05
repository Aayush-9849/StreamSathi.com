const express = require('express');
const router = express.Router();
const Plan = require('../models/Plan');
const { protect } = require('../middleware/auth');

// @desc    Get all active platform subscription plans
// @route   GET /api/plans
// @access  Public
router.get('/', async (req, res) => {
  try {
    const plans = await Plan.find().sort({ platform: 1, price: 1 });
    return res.status(200).json({ success: true, plans });
  } catch (error) {
    console.error('Fetch plans error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving plans.' });
  }
});

// @desc    Update a pricing plan price and description features
// @route   PUT /api/plans/:id
// @access  Private (Admin Only)
router.put('/:id', protect, async (req, res) => {
  const { price, details } = req.body;

  try {
    // Validate admin privileges
    const isAdmin = req.user.email === 'kumaryada263@gmail.com';
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
    }

    if (price === undefined || !details) {
      return res.status(400).json({ success: false, message: 'Please provide both price and details.' });
    }

    const plan = await Plan.findById(req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Pricing plan tier not found.' });
    }

    plan.price = Number(price);
    plan.details = details;
    await plan.save();

    console.log(`Plan Updated [${plan.platform} - ${plan.name}]: Rs. ${plan.price}, Details: ${plan.details}`);

    return res.status(200).json({
      success: true,
      message: 'Subscription plan updated successfully.',
      plan,
    });
  } catch (error) {
    console.error('Update plan error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating plan.' });
  }
});

module.exports = router;
