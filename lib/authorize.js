const { getDb } = require('./db');

/**
 * Middleware: user must be logged in.
 */
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }

  const db = getDb();
  const user = db.prepare('SELECT role FROM users WHERE usos_id = ?').get(req.session.user.usos_id);

  if (!user) {
    return req.session.destroy(() => res.redirect('/auth/login'));
  }

  req.session.user.role = user.role;

  if (!user.role) {
    return res.redirect('/auth/pending');
  }

  res.locals.user = req.session.user;
  next();
}

/**
 * Middleware: require one of the specified roles.
 */
function requireRole(...roles) {
  return [
    requireAuth,
    (req, res, next) => {
      if (!roles.includes(req.session.user.role)) {
        return res.status(403).render('error', {
          message: `Access denied. Required role: ${roles.join(' or ')}.`,
        });
      }
      next();
    },
  ];
}

module.exports = { requireAuth, requireRole };