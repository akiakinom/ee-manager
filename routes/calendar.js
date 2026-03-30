const express = require('express');
const router = express.Router();
const { requireRole } = require('../lib/authorize');
const { getDb } = require('../lib/db');

router.use(requireRole('admin', 'editor'));

const DAYS = { 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday' };

// helper: toggle + delete factory to avoid repetition
function crudRoutes(table) {
  router.post(`/${table}/:id/toggle`, (req, res) => {
    getDb().prepare(`UPDATE ${table} SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END WHERE id = ?`).run(req.params.id);
    res.redirect('/dashboard/calendar');
  });
  router.post(`/${table}/:id/delete`, (req, res) => {
    getDb().prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    res.redirect('/dashboard/calendar');
  });
}

/**
 * GET /dashboard/calendar
 */
router.get('/', (req, res) => {
  const db = getDb();

  const semesters = db.prepare(`
    SELECT s.*, u.name as author FROM calendar_semesters s
    LEFT JOIN users u ON s.created_by = u.usos_id ORDER BY s.start_date DESC
  `).all();

  const substitutions = db.prepare(`
    SELECT s.*, u.name as author FROM calendar_substitutions s
    LEFT JOIN users u ON s.created_by = u.usos_id ORDER BY s.original_date DESC
  `).all();

  const breaks = db.prepare(`
    SELECT s.*, u.name as author FROM calendar_breaks s
    LEFT JOIN users u ON s.created_by = u.usos_id ORDER BY s.date_from DESC
  `).all();

  const exams = db.prepare(`
    SELECT s.*, u.name as author FROM calendar_exams s
    LEFT JOIN users u ON s.created_by = u.usos_id ORDER BY s.date_from DESC
  `).all();

  const deans = db.prepare(`
    SELECT s.*, u.name as author FROM calendar_deans_hours s
    LEFT JOIN users u ON s.created_by = u.usos_id ORDER BY s.date DESC
  `).all();

  res.render('dashboard/calendar', { user: req.session.user, semesters, substitutions, breaks, exams, deans, days: DAYS });
});

// ── Semesters ──────────────────────────────────────────────────────────────

router.post('/semesters', (req, res) => {
  const { semester_id, start_date, is_published } = req.body;
  if (!semester_id || !start_date) return res.status(400).render('error', { message: 'semester id and start date are required.', error: null });
  getDb().prepare(`INSERT INTO calendar_semesters (semester_id, start_date, is_published, created_by) VALUES (?, ?, ?, ?)`)
    .run(semester_id.trim(), start_date, is_published ? 1 : 0, req.session.user.usos_id);
  res.redirect('/dashboard/calendar');
});

crudRoutes('calendar_semesters');

// ── Substitutions ──────────────────────────────────────────────────────────

router.post('/substitutions', (req, res) => {
  const { original_date, day_of_week, is_published } = req.body;
  const dow = parseInt(day_of_week, 10);
  if (!original_date || !dow || dow < 1 || dow > 5) return res.status(400).render('error', { message: 'original date and a valid day (1-5) are required.', error: null });
  getDb().prepare(`INSERT INTO calendar_substitutions (original_date, day_of_week, is_published, created_by) VALUES (?, ?, ?, ?)`)
    .run(original_date, dow, is_published ? 1 : 0, req.session.user.usos_id);
  res.redirect('/dashboard/calendar');
});

crudRoutes('calendar_substitutions');

// ── Breaks ─────────────────────────────────────────────────────────────────

router.post('/breaks', (req, res) => {
  const { type, date_from, date_to, is_published } = req.body;
  if (!type || !date_from || !date_to) return res.status(400).render('error', { message: 'type, from, and to are required.', error: null });
  getDb().prepare(`INSERT INTO calendar_breaks (type, date_from, date_to, is_published, created_by) VALUES (?, ?, ?, ?, ?)`)
    .run(type, date_from, date_to, is_published ? 1 : 0, req.session.user.usos_id);
  res.redirect('/dashboard/calendar');
});

crudRoutes('calendar_breaks');

// ── Exam seasons ───────────────────────────────────────────────────────────

router.post('/exams', (req, res) => {
  const { date_from, date_to, is_published } = req.body;
  if (!date_from || !date_to) return res.status(400).render('error', { message: 'from and to dates are required.', error: null });
  getDb().prepare(`INSERT INTO calendar_exams (date_from, date_to, is_published, created_by) VALUES (?, ?, ?, ?)`)
    .run(date_from, date_to, is_published ? 1 : 0, req.session.user.usos_id);
  res.redirect('/dashboard/calendar');
});

crudRoutes('calendar_exams');

// ── Dean's hours ───────────────────────────────────────────────────────────

router.post('/deans', (req, res) => {
  const { date, time_from, time_to, is_published } = req.body;
  if (!date || !time_from || !time_to) return res.status(400).render('error', { message: 'date and time range are required.', error: null });
  getDb().prepare(`INSERT INTO calendar_deans_hours (date, time_from, time_to, is_published, created_by) VALUES (?, ?, ?, ?, ?)`)
    .run(date, time_from, time_to, is_published ? 1 : 0, req.session.user.usos_id);
  res.redirect('/dashboard/calendar');
});

crudRoutes('calendar_deans_hours');

module.exports = router;