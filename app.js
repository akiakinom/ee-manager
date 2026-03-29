require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const eventsRoutes = require('./routes/events');
const calendarRoutes = require('./routes/calendar');
const { requireAuth } = require('./lib/authorize');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// Routes
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/dashboard/events', eventsRoutes);
app.use('/dashboard/calendar', calendarRoutes);

app.get('/', (req, res) => res.redirect('/dashboard'));
app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard/index', { user: req.session.user });
});

// 404
app.use((req, res) => {
  res.status(404).render('error', { message: 'Page not found.', error: null });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { message: err.message, error: err });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});