require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const publicRoutes = require('./routes/publicRoutes');
const adminRoutes = require('./routes/adminRoutes');
const billingRoutes = require('./routes/billingRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const emailService = require('./services/emailService');
const { buildMetaHtml, injectMetaIntoHtml, findRestaurantBySlug } = require('./utils/meta');

async function checkTrialExpiry() {
  try {
    const rows = db.prepare(`
      SELECT id, name, email, trial_expires_at
      FROM restaurants
      WHERE trial_reminder_sent = 0
        AND trial_expires_at IS NOT NULL
        AND julianday(trial_expires_at) - julianday('now') BETWEEN 0 AND 3
    `).all();

    if (rows.length === 0) return;
    console.log(`[trial-check] found ${rows.length} restaurant(s) needing reminder`);

    const markSent = db.prepare('UPDATE restaurants SET trial_reminder_sent = 1 WHERE id = ?');

    for (const row of rows) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(row.trial_expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      );
      const result = await emailService.sendTrialExpiringEmail(row.email, row.name, daysLeft);
      if (result.ok) {
        markSent.run(row.id);
        console.log(`[trial-check] reminder sent to ${row.email} (${daysLeft}d left)`);
      } else {
        console.warn(`[trial-check] skip ${row.email}: ${result.reason}`);
      }
    }
  } catch (err) {
    console.error('[trial-check] failed:', err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS allowlist — set CORS_ORIGINS to a comma-separated list of allowed origins.
// Default in production: only allow same-origin (no Origin header / matching PUBLIC_BASE_URL).
// Default in development: allow everything (legacy behavior).
const corsOriginsRaw = process.env.CORS_ORIGINS || '';
const corsAllowList = corsOriginsRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // same-origin / curl / server-to-server
      if (corsAllowList.length === 0) return cb(null, isDev);
      if (corsAllowList.includes('*')) return cb(null, true);
      if (corsAllowList.includes(origin)) return cb(null, true);
      return cb(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
// Trust proxy so req.ip reflects the real client (Railway/Heroku-style proxy).
app.set('trust proxy', 1);

app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingRoutes.handleWebhook
);

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  stripeRoutes.handleStripeWebhook
);

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'QR Jidelnicek Pro' }));

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/stripe', stripeRoutes);

const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  const indexHtmlPath = path.join(distDir, 'index.html');
  let cachedIndexHtml = null;
  const readIndexHtml = () => {
    if (cachedIndexHtml === null) {
      cachedIndexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    }
    return cachedIndexHtml;
  };

  app.use(express.static(distDir, { index: false }));

  app.get('/menu/:slug', (req, res, next) => {
    try {
      const restaurant = findRestaurantBySlug(req.params.slug);
      if (!restaurant) {
        return res.status(200).type('html').send(readIndexHtml());
      }
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = process.env.PUBLIC_BASE_URL || `${proto}://${host}`;
      const metaHtml = buildMetaHtml(restaurant, baseUrl);
      const html = injectMetaIntoHtml(readIndexHtml(), metaHtml);
      res.status(200).type('html').send(html);
    } catch (err) {
      console.error('[ssr-meta] failed:', err);
      next();
    }
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtmlPath);
  });
} else {
  console.warn(`[server] frontend dist not found at ${distDir} — skipping static serving`);
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

app.listen(PORT, () => {
  console.log(`QR Jidelnicek API listening on http://localhost:${PORT}`);
  checkTrialExpiry();
  setInterval(checkTrialExpiry, 24 * 60 * 60 * 1000);
});
