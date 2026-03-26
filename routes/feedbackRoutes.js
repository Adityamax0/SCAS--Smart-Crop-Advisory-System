const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const User = require('../models/User');
const Notification = require('../models/Notification');
const protect = require('../middleware/auth');

/**
 * @route   POST /api/feedback
 * @desc    Submit user feedback for an AI response
 * @access  Private (Farmer)
 */
router.post('/', protect, async (req, res) => {
  try {
    const { query, aiResponse, vote } = req.body;

    const feedback = await Feedback.create({
      user: req.user._id,
      query,
      aiResponse,
      vote,
      district: req.user.district
    });

    // If feedback is negative, alert the Sub-Head for expert review
    if (vote === 'down') {
      const subHeads = await User.find({ 
        role: 'subhead', 
        district: req.user.district 
      });

      for (const sh of subHeads) {
        await Notification.create({
          recipient: sh._id,
          channel: 'push',
          title: '⚠️ AI Advice Flagged for Review',
          content: `A farmer in ${req.user.district} marked AI advice as unhelpful. Query: "${query.slice(0, 50)}..."`,
          metadata: { feedbackId: feedback._id }
        });
      }
    }

    res.status(201).json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Feedback Error:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

module.exports = router;
