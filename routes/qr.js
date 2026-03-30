const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { requireRole } = require('../lib/authorize');
const { getDb } = require('../lib/db');

// ── Public redirect ────────────────────────────────────────────────────────

/**
 * GET /qr/:slug
 * Public redirect — no auth needed. Also increments scan counter.
 */
router.get('/qr/:slug', (req, res) => {
  const db = getDb();
  const link = db.prepare('SELECT * FROM qr_links WHERE slug = ?').get(req.params.slug);

  if (!link) return res.status(404).render('error', { message: `QR link "/${req.params.slug}" not found.`, error: null });

  db.prepare('UPDATE qr_links SET scan_count = scan_count + 1 WHERE id = ?').run(link.id);
  res.redirect(link.target_url);
});

// ── Dashboard routes (auth required) ──────────────────────────────────────

router.use('/dashboard/qr', requireRole('admin', 'editor'));

/**
 * GET /dashboard/qr
 */
router.get('/dashboard/qr', (req, res) => {
  const db = getDb();
  const links = db.prepare(`
    SELECT q.*, u.name as author
    FROM qr_links q
    LEFT JOIN users u ON q.created_by = u.usos_id
    ORDER BY q.created_at DESC
  `).all();

  res.render('dashboard/qr', { user: req.session.user, links });
});

/**
 * GET /dashboard/qr/new
 */
router.get('/dashboard/qr/new', (req, res) => {
  res.render('dashboard/qr-form', { user: req.session.user, link: null, error: null });
});

/**
 * POST /dashboard/qr
 */
router.post('/dashboard/qr', (req, res) => {
  const { slug, target_url, label, color } = req.body;

  if (!slug || !target_url) {
    return res.render('dashboard/qr-form', {
      user: req.session.user,
      link: req.body,
      error: 'slug and target URL are required.',
    });
  }

  // Slugs: lowercase alphanumeric + hyphens only
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.render('dashboard/qr-form', {
      user: req.session.user,
      link: req.body,
      error: 'slug can only contain lowercase letters, numbers, and hyphens.',
    });
  }

  const db = getDb();
  try {
    db.prepare(`
      INSERT INTO qr_links (slug, target_url, label, color, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(slug.toLowerCase(), target_url, label || null, color || '#000000', req.session.user.usos_id);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.render('dashboard/qr-form', {
        user: req.session.user,
        link: req.body,
        error: `slug "${slug}" is already taken.`,
      });
    }
    throw e;
  }

  res.redirect('/dashboard/qr');
});

/**
 * GET /dashboard/qr/:id/edit
 */
router.get('/dashboard/qr/:id/edit', (req, res) => {
  const db = getDb();
  const link = db.prepare('SELECT * FROM qr_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).render('error', { message: 'Link not found.', error: null });
  res.render('dashboard/qr-form', { user: req.session.user, link, error: null });
});

/**
 * POST /dashboard/qr/:id/edit
 */
router.post('/dashboard/qr/:id/edit', (req, res) => {
  const { slug, target_url, label, color } = req.body;

  if (!slug || !target_url) {
    return res.render('dashboard/qr-form', {
      user: req.session.user,
      link: { ...req.body, id: req.params.id },
      error: 'slug and target URL are required.',
    });
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return res.render('dashboard/qr-form', {
      user: req.session.user,
      link: { ...req.body, id: req.params.id },
      error: 'slug can only contain lowercase letters, numbers, and hyphens.',
    });
  }

  const db = getDb();
  try {
    db.prepare(`
      UPDATE qr_links SET slug = ?, target_url = ?, label = ?, color = ? WHERE id = ?
    `).run(slug.toLowerCase(), target_url, label || null, color || '#000000', req.params.id);
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      return res.render('dashboard/qr-form', {
        user: req.session.user,
        link: { ...req.body, id: req.params.id },
        error: `slug "${slug}" is already taken.`,
      });
    }
    throw e;
  }

  res.redirect('/dashboard/qr');
});

/**
 * POST /dashboard/qr/:id/delete
 */
router.post('/dashboard/qr/:id/delete', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM qr_links WHERE id = ?').run(req.params.id);
  res.redirect('/dashboard/qr');
});

/**
 * GET /dashboard/qr/:id/image.png
 * Generates and streams a styled QR code PNG with rounded modules and optional logo.
 */
router.get('/dashboard/qr/:id/image.png', async (req, res) => {
  const db = getDb();
  const link = db.prepare('SELECT * FROM qr_links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).end();

  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const qrUrl = `${appUrl}/qr/${link.slug}`;
  const color = link.color || '#000000';

  try {
    // Generate base QR as data URL so we can draw onto a canvas
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'H', // high — needed for logo overlay
      margin: 2,
      width: 600,
      color: {
        dark: color,
        light: '#ffffff',
      },
    });

    // Use canvas to add rounded corners and a logo overlay
    const { createCanvas, loadImage } = require('canvas');
    const SIZE = 600;
    const canvas = createCanvas(SIZE, SIZE);
    const ctx = canvas.getContext('2d');

    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Load and draw the raw QR
    const qrImg = await loadImage(dataUrl);
    ctx.drawImage(qrImg, 0, 0, SIZE, SIZE);

    // Draw logo in the center (white circle + text placeholder)
    const centerX = SIZE / 2;
    const centerY = SIZE / 2;
    const logoR = 48;

    ctx.beginPath();
    ctx.arc(centerX, centerY, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw "QR" text as logo (replace with actual image if you have one)
    ctx.fillStyle = color;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('QR', centerX, centerY);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${link.slug}.png"`);
    canvas.createPNGStream().pipe(res);
  } catch (err) {
    // canvas not installed — fall back to plain QR
    console.warn('canvas not available, serving plain QR:', err.message);
    const buffer = await QRCode.toBuffer(qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 600,
      color: { dark: color, light: '#ffffff' },
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${link.slug}.png"`);
    res.send(buffer);
  }
});

module.exports = router;