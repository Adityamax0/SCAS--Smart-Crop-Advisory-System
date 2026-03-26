const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, phone, email, password, role, district, state, coordinates: rawCoordinates } = req.body;

    // Safely parse coordinates if they arrive as strings (e.g., from FormData)
    let parsedCoordinates = undefined;
    if (rawCoordinates) {
      try {
        parsedCoordinates = typeof rawCoordinates === 'string' ? JSON.parse(rawCoordinates) : rawCoordinates;
        if (!Array.isArray(parsedCoordinates) || parsedCoordinates.length !== 2) {
          parsedCoordinates = undefined; // Fallback to avoid Mongoose GeoJSON CastError
        }
      } catch (err) {
        console.warn(`[AUTH] Invalid coordinates format during registration for phone: ${phone}`);
        parsedCoordinates = undefined;
      }
    }

    // Check if phone already exists
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Phone number already registered.' });
    }

    // Only admins can create non-farmer accounts
    if (role && role !== 'farmer') {
      if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can create worker, sub-head, or admin accounts.',
        });
      }
    }

    const user = await User.create({
      name,
      phone,
      email,
      password,
      role: role || 'farmer',
      district,
      state,
      location: parsedCoordinates
        ? { type: 'Point', coordinates: parsedCoordinates }
        : undefined,
    });

    // Retroactively assign isolated tickets to newly hired workers
    if (user.role === 'worker' && parsedCoordinates) {
      const { reassignPendingTickets } = require('../services/escalationService');
      // Fire asynchronously to avoid blocking user creation response
      reassignPendingTickets(user).catch(console.error);
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        district: user.district,
        token,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Duplicate entry. Phone or email already exists.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password are required.' });
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account deactivated.' });
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        district: user.district,
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

/**
 * GET /api/auth/demo-credentials
 * Returns one phone number per role for demo login
 */
const getDemoCredentials = async (req, res) => {
  try {
    const [farmer, worker, subhead, admin] = await Promise.all([
      User.findOne({ role: 'farmer' }).select('phone'),
      User.findOne({ role: 'worker' }).select('phone'),
      User.findOne({ role: 'subhead' }).select('phone'),
      User.findOne({ role: 'admin' }).select('phone'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        farmer: farmer?.phone || null,
        worker: worker?.phone || null,
        subhead: subhead?.phone || null,
        admin: admin?.phone || null,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getMe, getDemoCredentials };
