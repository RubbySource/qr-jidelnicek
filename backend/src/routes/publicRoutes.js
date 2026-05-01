const express = require('express');
const QRCode = require('qrcode');
const db = require('../db');
const { ITEM_COLUMNS, normalizeItem } = require('../menu');

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
    `SELECT ${ITEM_COLUMNS} FROM items WHERE category_id = ? ORDER BY "order" ASC, id ASC`
  );

  const result = categories.map((c) => ({
    ...c,
    items: itemStmt.all(c.id).map(normalizeItem),
  }));

  res.json({ restaurant, menu, categories: result });
});

router.get('/qr/:slug', async (req, res) => {
  const exists = db.prepare('SELECT id FROM restaurants WHERE slug = ?').get(req.params.slug);
  if (!exists) return res.status(404).json({ error: 'restaurant not found' });

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const url = `${baseUrl.replace(/\/$/, '')}/menu/${req.params.slug}`;

  const sizeRaw = parseInt(req.query.size, 10);
  const size = Number.isFinite(sizeRaw) ? Math.min(2048, Math.max(128, sizeRaw)) : 512;
  const format = String(req.query.format || 'png').toLowerCase();
  const download = req.query.download === '1';

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(url, { type: 'svg', margin: 2, width: size });
      res.setHeader('Content-Type', 'image/svg+xml');
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="qr-${req.params.slug}.svg"`);
      }
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(svg);
    }

    const png = await QRCode.toBuffer(url, { width: size, margin: 2 });
    res.setHeader('Content-Type', 'image/png');
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="qr-${req.params.slug}.png"`);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'failed to generate QR' });
  }
});

module.exports = router;
