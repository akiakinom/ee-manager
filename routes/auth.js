const express = require('express');
const router = express.Router();
const { getRequestToken, getAccessToken, fetchUsosUser } = require('../lib/usos');
const { getDb } = require('../lib/db');

/**
 * GET /auth/login
 */
router.get('/login', async (req, res) => {
  try {
    const { requestToken, requestTokenSecret, authorizeUrl } = await getRequestToken();

    req.session.oauthRequestToken = requestToken;
    req.session.oauthRequestTokenSecret = requestTokenSecret;

    res.redirect(authorizeUrl);
  } catch (err) {
    console.error('Failed to get USOS request token:', err.message);
    res.render('error', { message: 'Could not connect to USOS. Please try again later.' });
  }
});

/**
 * GET /auth/callback
 */
router.get('/callback', async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;

  if (!oauth_verifier) {
    return res.render('error', { message: 'Authorization was cancelled.' });
  }

  if (oauth_token !== req.session.oauthRequestToken) {
    return res.render('error', { message: 'OAuth token mismatch. Please try logging in again.' });
  }

  const requestTokenSecret = req.session.oauthRequestTokenSecret;

  try {

    const { accessToken, accessTokenSecret } = await getAccessToken(
      oauth_token,
      requestTokenSecret,
      oauth_verifier
    );

    const usosUser = await fetchUsosUser(accessToken, accessTokenSecret);

    const db = getDb();
    const fullName = `${usosUser.first_name} ${usosUser.last_name}`;


    db.prepare(`
    INSERT INTO users (usos_id, name)
    VALUES (?, ?)
    ON CONFLICT(usos_id) DO UPDATE SET
        name  = excluded.name
    `).run(usosUser.id, fullName);

    const user = db.prepare('SELECT * FROM users WHERE usos_id = ?').get(usosUser.id);

    delete req.session.oauthRequestToken;
    delete req.session.oauthRequestTokenSecret;

    req.session.user = {
      usos_id: usosUser.id,
      name: user.name,
      role: user.role,
    };

    if (!user.role) {
      return res.redirect('/auth/pending');
    }

    res.redirect('/dashboard');
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    res.render('error', { message: err.message, error: err });
  }
});

/**
 * GET /auth/pending
 */
router.get('/pending', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  if (req.session.user.role) return res.redirect('/dashboard');

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE usos_id = ?').get(req.session.usos_id);

  if (user?.role) {
    req.session.user.role = user.role;
    return res.redirect('/dashboard');
  }

  res.render('pending', { user: req.session.user });
});

/**
 * GET /auth/logout
 */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
});

module.exports = router;