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
const emailService = require('./services/emailService');

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

app.use(cors());

app.post(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingRoutes.handleWebhook
);

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'QR Jidelnicek Pro' }));

app.use('/api/auth', authRoutes);
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);

const distDir = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
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
