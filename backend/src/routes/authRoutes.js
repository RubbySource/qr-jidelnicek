const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { toNum } = require('../db');
const { signToken } = require('../auth');
const emailService = require('../services/emailService');
const { sendEmail } = require('../email');
const { createRateLimiter } = require('../utils/rateLimit');

const router = express.Router();

// Rate limiters — disabled when DISABLE_RATE_LIMIT is set (test env).
const noop = (req, res, next) => next();
const rateLimitsDisabled = process.env.DISABLE_RATE_LIMIT === '1';

const loginLimiter = rateLimitsDisabled ? noop : createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Příliš mnoho pokusů o přihlášení. Zkuste to prosím za 15 minut.',
});
const registerLimiter = rateLimitsDisabled ? noop : createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Překročen limit registrací z této IP. Zkuste to prosím za hodinu.',
});
const forgotLimiter = rateLimitsDisabled ? noop : createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Příliš mnoho žádostí o obnovení hesla. Zkuste to prosím za hodinu.',
});

function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', registerLimiter, async (req, res) => {
  const { name, email, password, slug } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email format' });
  }
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }
  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 120) {
    return res.status(400).json({ error: 'name must be 1-120 characters' });
  }

  let finalSlug = slugify(slug || name);
  if (!finalSlug) return res.status(400).json({ error: 'invalid slug' });

  const existsSlug = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(finalSlug);
  if (existsSlug) {
    let i = 2;
    while (db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(`${finalSlug}-${i}`)) i++;
    finalSlug = `${finalSlug}-${i}`;
  }

  const existsEmail = db.prepare('SELECT id FROM restaurants WHERE email = ?').get(email);
  if (existsEmail) return res.status(409).json({ error: 'email already registered' });

  const hash = await bcrypt.hash(password, 10);

  // 14-day trial — store as ISO without 'Z'; days-left calc reads it as UTC.
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('Z', '')
    .replace('T', ' ')
    .slice(0, 19);

  const insertRestaurant = db.prepare(
    'INSERT INTO restaurants (name, slug, email, password_hash, subscription_status, trial_expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const result = insertRestaurant.run(name, finalSlug, email, hash, 'trial', trialEndsAt);
  const restaurantId = toNum(result.lastInsertRowid);

  const menuResult = db.prepare(
    'INSERT INTO menus (restaurant_id, name, active) VALUES (?, ?, 1)'
  ).run(restaurantId, 'Hlavní menu');

  const token = signToken({ id: restaurantId, slug: finalSlug });

  emailService.sendWelcomeEmail(email, name).catch((err) => {
    console.error('[auth] welcome email failed:', err.message);
  });

  res.status(201).json({
    token,
    restaurant: { id: restaurantId, name, slug: finalSlug, email },
    menu: { id: toNum(menuResult.lastInsertRowid), name: 'Hlavní menu' },
  });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const row = db.prepare('SELECT * FROM restaurants WHERE email = ?').get(email);
  if (!row) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = signToken({ id: row.id, slug: row.slug });
  res.json({
    token,
    restaurant: { id: row.id, name: row.name, slug: row.slug, email: row.email, plan: row.plan },
  });
});

// Returns the SHA-256 hex digest of a token; we store this, not the raw token.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/forgot', forgotLimiter, async (req, res) => {
  const { email } = req.body || {};
  // Always respond success to prevent email enumeration.
  if (!email || typeof email !== 'string') return res.json({ ok: true });

  const row = db.prepare('SELECT id, name, email FROM restaurants WHERE email = ?').get(email);
  if (!row) {
    // Constant-time-ish: do a fake bcrypt compare so timing leaks less info.
    await bcrypt.compare('xxx', '$2a$10$abcdefghijklmnopqrstuv').catch(() => {});
    return res.json({ ok: true });
  }

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString().replace('Z', '').replace('T', ' ').slice(0, 19);

  db.prepare(`
    INSERT OR REPLACE INTO password_resets (token_hash, restaurant_id, expires_at, used_at)
    VALUES (?, ?, ?, NULL)
  `).run(tokenHash, row.id, expiresAt);

  // Sweep old / used tokens.
  db.prepare("DELETE FROM password_resets WHERE expires_at < datetime('now', '-7 days')").run();

  const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const resetUrl = `${baseUrl.replace(/\/$/, '')}/admin?reset=${encodeURIComponent(token)}`;

  sendEmail({
    to: row.email,
    subject: 'Obnovení hesla — QR Jídelníček Pro',
    template: 'password-reset',
    vars: { restaurantName: row.name ? ` (${row.name})` : '', resetUrl },
  }).catch((err) => console.error('[auth/forgot] email failed:', err.message));

  res.json({ ok: true });
});

router.post('/reset', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'token a password jsou povinné' });
  if (typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'password musí mít alespoň 6 znaků' });
  }

  const tokenHash = hashToken(String(token));
  const row = db.prepare(`
    SELECT pr.token_hash, pr.restaurant_id, pr.expires_at, pr.used_at, r.email, r.slug
    FROM password_resets pr
    JOIN restaurants r ON r.id = pr.restaurant_id
    WHERE pr.token_hash = ?
  `).get(tokenHash);

  if (!row || row.used_at || new Date(row.expires_at + 'Z').getTime() < Date.now()) {
    return res.status(400).json({ error: 'Odkaz pro obnovení hesla je neplatný nebo vypršel.' });
  }

  const hash = await bcrypt.hash(password, 10);
  const tx = db.transaction(() => {
    db.prepare('UPDATE restaurants SET password_hash = ? WHERE id = ?').run(hash, row.restaurant_id);
    db.prepare("UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?").run(tokenHash);
  });
  tx();

  const newToken = signToken({ id: row.restaurant_id, slug: row.slug });
  res.json({
    token: newToken,
    restaurant: { id: row.restaurant_id, email: row.email, slug: row.slug },
  });
});

module.exports = router;
