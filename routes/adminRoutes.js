const express = require('express');
const { getDashboardStats, getEscalationReport } = require('../controllers/adminController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const User = require('../models/User');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, authorize('admin'));

router.get('/dashboard', getDashboardStats);
router.get('/escalation-report', getEscalationReport);

// ─── Staff Management (Admin Only) ───────────────────────────────────────────

/**
 * POST /api/admin/staff
 * Create a new Worker, Sub-Head, or Admin account
 * Only the Admin/Project Manager can call this.
 */
router.post('/staff', async (req, res) => {
  try {
    const { name, phone, password, role, district, state } = req.body;

    const allowedRoles = ['worker', 'subhead', 'admin'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: `Role must be one of: ${allowedRoles.join(', ')}` });
    }

    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    const user = await User.create({ name, phone, password, role, district, state });

    res.status(201).json({
      success: true,
      message: `${role.toUpperCase()} account created successfully.`,
      data: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        district: user.district,
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/admin/staff
 * List all non-farmer accounts (Workers, Sub-Heads, Admins)
 */
router.get('/staff', async (req, res) => {
  try {
    const { role, district } = req.query;
    const filter = { role: { $in: ['worker', 'subhead', 'admin'] } };
    if (role) filter.role = role;
    if (district) filter.district = district;

    const staff = await User.find(filter).select('-password').sort({ role: 1, createdAt: -1 });
    res.status(200).json({ success: true, data: staff, total: staff.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/staff/:id/toggle
 * Activate or Deactivate a staff account
 */
router.patch('/staff/:id/toggle', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.role === 'farmer') return res.status(400).json({ success: false, message: 'Cannot toggle farmer accounts here.' });

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `Account ${user.isActive ? 'ACTIVATED' : 'DEACTIVATED'} for ${user.name}`,
      data: { id: user._id, name: user.name, isActive: user.isActive }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PATCH /api/admin/staff/:id/reset-password
 * Admin resets a staff member's password
 */
router.patch('/staff/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.password = newPassword; // Model pre-save hook will re-hash it
    await user.save();

    res.status(200).json({ success: true, message: `Password reset successfully for ${user.name}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
