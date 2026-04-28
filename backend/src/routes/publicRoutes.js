const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');

const router = express.Router();

router.get('/menu/:slug', (req, res) => {
  const restaurant = db.prepare(
    'SELECT id, name, slug FROM restaurants WHERE slug = ?'
  ).get(req.params.slug);
  if (!restaurant) return res.status(404).json({ error: 'restaurant not found' });

  const menu = db.prepare(
    'SELECT id, name FROM menus WHERE restaurant_id = ? AND active = 1 ORDER BY id ASC LIMIT 1'
  ).get(restaurant.id);
  if (!menu) return res.json({ restaurant, menu: null, categories: [] });

  const categories = db.prepare(
    'SELECT id, name, "order" FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(menu.id);

  const itemStmt = db.prepare(
    'SELECT id, name, description, price, image_url, available FROM items WHERE category_id = ? ORDER BY id ASC'
  );

  const result = categories.map((c) => ({
    ...c,
    items: itemStmt.all(c.id).map((it) => ({ ...it, available: !!it.available })),
  }));

  res.json({ restaurant, menu, categories: result });
});

router.get('/qr/:slug', async (req, res) => {
  const exists = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!exists) return res.status(404).json({ error: 'restaurant not found' });

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const url = `${baseUrl.replace(/\/$/, '')}/menu/${req.params.slug}`;

  try {
    const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'failed to generate QR' });
  }
});

module.exports = router;
