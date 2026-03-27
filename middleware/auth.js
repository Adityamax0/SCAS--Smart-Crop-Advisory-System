const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * 🔒 Protect Middleware: Traditional JWT Verification (Strict)
 */
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'SCAS Security: Auth token missing. Please log in.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Security Alert: User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: error.name === 'TokenExpiredError' ? 'Session expired.' : 'Invalid token.' 
    });
  }
};

/**
 * 🛡️ restrictTo: Role-Based Access Control
 * Usage: restrictTo('admin', 'subhead')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `SCAS Access Denied: Role '${req.user?.role || 'Guest'}' is not authorized for this operation.`
      });
    }
    next();
  };
};

/**
 * 🔓 Optional Auth Middleware
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  protect,
  authenticate: protect,
  restrictTo,
  authorize: restrictTo,
  optionalAuth
};
