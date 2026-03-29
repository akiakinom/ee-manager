const express = require('express');
const router = express.Router();
const { requireRole } = require('../lib/authorize');
const { getDb } = require('../lib/db');

// All admin routes require admin role
router.use(requireRole('admin'));

/**
 * GET /admin/users
 */
router.get('/users', (req, res) => {
  const db = getDb();

  const pending = db.prepare(`
    SELECT * FROM users WHERE role IS NULL ORDER BY created_at ASC
  `).all();

  const active = db.prepare(`
    SELECT * FROM users WHERE role IS NOT NULL ORDER BY role ASC, name ASC
  `).all();

  res.render('admin/users', { user: req.session.user, pending, active });
});

/**
 * POST /admin/users/:usos_id/role
 */
router.post('/users/:usos_id/role', (req, res) => {
  const { usos_id } = req.params;
  const { role } = req.body;

  if (!['admin', 'editor'].includes(role)) {
    return res.status(400).render('error', { message: 'Invalid role.', error: null });
  }

  // Prevent admin from demoting themselves
  if (usos_id === req.session.user.usos_id) {
    return res.status(400).render('error', { message: 'You cannot change your own role.', error: null });
  }

  const db = getDb();
  db.prepare('UPDATE users SET role = ? WHERE usos_id = ?').run(role, usos_id);

  res.redirect('/admin/users');
});

/**
 * POST /admin/users/:usos_id/revoke
 */
router.post('/users/:usos_id/revoke', (req, res) => {
  const { usos_id } = req.params;

  if (usos_id === req.session.user.usos_id) {
    return res.status(400).render('error', { message: 'You cannot revoke your own access.', error: null });
  }

  const db = getDb();
  db.prepare('UPDATE users SET role = NULL WHERE usos_id = ?').run(usos_id);

  res.redirect('/admin/users');
});

/**
 * POST /admin/users/:usos_id/delete
 */
router.post('/users/:usos_id/delete', (req, res) => {
  const { usos_id } = req.params;

  if (usos_id === req.session.user.usos_id) {
    return res.status(400).render('error', { message: 'You cannot delete yourself.', error: null });
  }

  const db = getDb();
  db.prepare('DELETE FROM users WHERE usos_id = ?').run(usos_id);

  res.redirect('/admin/users');
});

module.exports = router;
