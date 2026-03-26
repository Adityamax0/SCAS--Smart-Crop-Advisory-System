/**
 * Role-Based Access Control (RBAC) Middleware Factory
 * Usage: authorize('admin', 'subhead') — only allows users with those roles
 *
 * @param  {...string} allowedRoles - Roles permitted to access the route
 * @returns {Function} Express middleware
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before authorization.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Role '${req.user.role}' is not authorized. Required: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
};

module.exports = authorize;
