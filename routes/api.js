
const express = require('express');
const router = express.Router();
const { getDb } = require('../lib/db');

/**
 * GET /api/events
 */
router.get('/events', (req, res) => {
    const db = getDb();

    const events = db.prepare(`
        SELECT e.*, u.name as author
        FROM student_events e
        LEFT JOIN users u ON e.created_by = u.usos_id
        WHERE is_published = 1
        ORDER BY e.event_date DESC
    `).all();

    return res.json( events )
});

/**
 * GET /api/calendar
 */
router.get('/calendar', (req, res) => {
    const db = getDb();

    const semesters = db.prepare(`
        SELECT s.*, u.name as author
        FROM calendar_semesters s
        LEFT JOIN users u ON s.created_by = u.usos_id
        WHERE is_published = 1
        ORDER BY s.start_date DESC
    `).all();

    const substitutions = db.prepare(`
        SELECT s.*, u.name as author
        FROM calendar_substitutions s
        LEFT JOIN users u ON s.created_by = u.usos_id
        WHERE is_published = 1
        ORDER BY s.original_date DESC
    `).all();

    return res.json({
        semesters, substitutions
    })
});

module.exports = router;