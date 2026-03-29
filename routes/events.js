const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { requireRole } = require('../lib/authorize');
const { getDb } = require('../lib/db');
const upload = require('../lib/upload');

router.use(requireRole('admin', 'editor'));

/**
 * GET /dashboard/events
 */
router.get('/', (req, res) => {
  const db = getDb();
  const events = db.prepare(`
    SELECT e.*, u.name as author
    FROM student_events e
    LEFT JOIN users u ON e.created_by = u.usos_id
    ORDER BY e.event_date DESC
  `).all();

  res.render('dashboard/events', { user: req.session.user, events });
});

/**
 * GET /dashboard/events/new
 */
router.get('/new', (req, res) => {
  res.render('dashboard/events-form', { user: req.session.user, event: null, error: null });
});

/**
 * POST /dashboard/events
 */
router.post('/', upload.single('image'), (req, res) => {
  const { title, location, event_date, description, is_published } = req.body;
  const image = req.file ? req.file.filename : null;

  if (!title || !event_date) {
    return res.render('dashboard/events-form', {
      user: req.session.user,
      event: req.body,
      error: 'title and date are required.',
    });
  }

  const db = getDb();
  db.prepare(`
    INSERT INTO student_events (title, location, event_date, description, image, is_published, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, location || null, event_date, description || null, image, is_published ? 1 : 0, req.session.user.usos_id);

  res.redirect('/dashboard/events');
});

/**
 * GET /dashboard/events/:id/edit
 */
router.get('/:id/edit', (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM student_events WHERE id = ?').get(req.params.id);

  if (!event) return res.status(404).render('error', { message: 'Event not found.', error: null });

  res.render('dashboard/events-form', { user: req.session.user, event, error: null });
});

/**
 * POST /dashboard/events/:id/edit
 */
router.post('/:id/edit', upload.single('image'), (req, res) => {
  const { title, location, event_date, description, is_published } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT * FROM student_events WHERE id = ?').get(req.params.id);

  if (!existing) return res.status(404).render('error', { message: 'Event not found.', error: null });

  if (!title || !event_date) {
    return res.render('dashboard/events-form', {
      user: req.session.user,
      event: { ...req.body, id: req.params.id },
      error: 'title and date are required.',
    });
  }

  // If a new image was uploaded, delete the old one
  let image = existing.image;
  if (req.file) {
    if (existing.image) {
      const oldPath = path.join(__dirname, '..', 'public', 'uploads', existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    image = req.file.filename;
  }

  db.prepare(`
    UPDATE student_events
    SET title = ?, location = ?, event_date = ?, description = ?, image = ?, is_published = ?
    WHERE id = ?
  `).run(title, location || null, event_date, description || null, image, is_published ? 1 : 0, req.params.id);

  res.redirect('/dashboard/events');
});

/**
 * POST /dashboard/events/:id/delete
 */
router.post('/:id/delete', (req, res) => {
  const db = getDb();
  const event = db.prepare('SELECT * FROM student_events WHERE id = ?').get(req.params.id);

  if (event?.image) {
    const imgPath = path.join(__dirname, '..', 'public', 'uploads', event.image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  db.prepare('DELETE FROM student_events WHERE id = ?').run(req.params.id);
  res.redirect('/dashboard/events');
});

/**
 * POST /dashboard/events/:id/toggle
 * Toggle published state
 */
router.post('/:id/toggle', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE student_events SET is_published = CASE WHEN is_published = 1 THEN 0 ELSE 1 END WHERE id = ?
  `).run(req.params.id);
  res.redirect('/dashboard/events');
});

module.exports = router;