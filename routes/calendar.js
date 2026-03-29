const express = require('express');
const router = express.Router();
const { requireRole } = require('../lib/authorize');
const { getDb } = require('../lib/db');

router.use(requireRole('admin', 'editor'));

const DAYS = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };

/**
 * GET /dashboard/calendar
 */
router.get('/', (req, res) => {
  const db = getDb();

  const semesters = db.prepare(`
    SELECT s.*, u.name as author
    FROM calendar_semesters s
    LEFT JOIN users u ON s.created_by = u.usos_id
    ORDER BY s.start_date DESC
  `).all();

  const substitutions = db.prepare(`
    SELECT s.*, u.name as author
    FROM calendar_substitutions s
    LEFT JOIN users u ON s.created_by = u.usos_id
    ORDER BY s.original_date DESC
  `).all();

  res.render('dashboard/calendar', { user: req.session.user, semesters, substitutions, days: DAYS });
});

// ── Semesters ──────────────────────────────────────────────────────────────

/**
 * POST /dashboard/calendar/semesters
 */
router.post('/semesters', (req, res) => {
  const { semester_id, start_date, is_published } = req.body;

  if (!semester_id || !start_date) {
    return res.status(400).render('error', { message: 'semester id and start date are required.', error: null });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO calendar_semesters (semester_id, start_date, is_published, created_by)
    VALUES (?, ?, ?, ?)
  `).run(semester_id.trim(), start_date, is_published ? 1 : 0, req.session.user.usos_id);

  res.redirect('/dashboard/calendar');
});

/**
 * POST /dashboard/calendar/semesters/:id/toggle
 */
router.post('/semesters/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE calendar_semesters SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END WHERE id = ?
  `).run(req.params.id);
  res.redirect('/dashboard/calendar');
});

/**
 * POST /dashboard/calendar/semesters/:id/delete
 */
router.post('/semesters/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM calendar_semesters WHERE id = ?').run(req.params.id);
  res.redirect('/dashboard/calendar');
});

// ── Substitutions ──────────────────────────────────────────────────────────

/**
 * POST /dashboard/calendar/substitutions
 */
router.post('/substitutions', (req, res) => {
  const { original_date, day_of_week, is_published } = req.body;
  const dow = parseInt(day_of_week, 10);

  if (!original_date || !dow || dow < 1 || dow > 5) {
    return res.status(400).render('error', { message: 'original date and a valid day (1-5) are required.', error: null });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO calendar_substitutions (original_date, day_of_week, is_published, created_by)
    VALUES (?, ?, ?, ?)
  `).run(original_date, dow, is_published ? 1 : 0, req.session.user.usos_id);

  res.redirect('/dashboard/calendar');
});

/**
 * POST /dashboard/calendar/substitutions/:id/toggle
 */
router.post('/substitutions/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE calendar_substitutions SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END WHERE id = ?
  `).run(req.params.id);
  res.redirect('/dashboard/calendar');
});

/**
 * POST /dashboard/calendar/substitutions/:id/delete
 */
router.post('/substitutions/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM calendar_substitutions WHERE id = ?').run(req.params.id);
  res.redirect('/dashboard/calendar');
});

module.exports = router;