const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { toNum } = require('../db');
const { signToken } = require('../auth');
const emailService = require('../services/emailService');

const router = express.Router();

function slugify(input) {
  return String(input)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

router.post('/register', async (req, res) => {
  const { name, email, password, slug } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
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

  const insertRestaurant = db.prepare(
    'INSERT INTO restaurants (name, slug, email, password_hash) VALUES (?, ?, ?, ?)'
  );
  const result = insertRestaurant.run(name, finalSlug, email, hash);
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

router.post('/login', async (req, res) => {
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

module.exports = router;
