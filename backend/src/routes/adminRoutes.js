const express = require('express');
const db = require('../db');
const { toNum } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

function getDefaultMenu(restaurantId) {
  return db.prepare(
    'SELECT id FROM menus WHERE restaurant_id = ? AND active = 1 ORDER BY id ASC LIMIT 1'
  ).get(restaurantId);
}

function ownsCategory(restaurantId, categoryId) {
  return db.prepare(`
    SELECT c.id FROM categories c
    JOIN menus m ON m.id = c.menu_id
    WHERE c.id = ? AND m.restaurant_id = ?
  `).get(categoryId, restaurantId);
}

function ownsItem(restaurantId, itemId) {
  return db.prepare(`
    SELECT i.id FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN menus m ON m.id = c.menu_id
    WHERE i.id = ? AND m.restaurant_id = ?
  `).get(itemId, restaurantId);
}

router.get('/me', (req, res) => {
  const r = db.prepare(
    'SELECT id, name, slug, email, plan, created_at FROM restaurants WHERE id = ?'
  ).get(req.user.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

router.get('/menu', (req, res) => {
  const menu = getDefaultMenu(req.user.id);
  if (!menu) return res.json({ menu: null, categories: [] });

  const categories = db.prepare(
    'SELECT id, name, "order" FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(menu.id);

  const itemStmt = db.prepare(
    'SELECT id, name, description, price, image_url, available FROM items WHERE category_id = ? ORDER BY id ASC'
  );

  res.json({
    menu,
    categories: categories.map((c) => ({
      ...c,
      items: itemStmt.all(c.id).map((it) => ({ ...it, available: !!it.available })),
    })),
  });
});

router.post('/categories', (req, res) => {
  const { name, order } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  const menu = getDefaultMenu(req.user.id);
  if (!menu) return res.status(400).json({ error: 'no active menu' });
  const result = db.prepare(
    'INSERT INTO categories (menu_id, name, "order") VALUES (?, ?, ?)'
  ).run(menu.id, name, Number.isFinite(order) ? order : 0);
  res.status(201).json({ id: result.lastInsertRowid, name, order: order || 0 });
});

router.put('/categories/:id', (req, res) => {
  const { name, order } = req.body || {};
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE categories SET name = COALESCE(?, name), "order" = COALESCE(?, "order") WHERE id = ?')
    .run(name ?? null, Number.isFinite(order) ? order : null, req.params.id);
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/items', (req, res) => {
  const { category_id, name, description, price, image_url, available } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
  if (!ownsCategory(req.user.id, category_id)) return res.status(403).json({ error: 'forbidden' });

  const result = db.prepare(`
    INSERT INTO items (category_id, name, description, price, image_url, available)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    category_id,
    name,
    description || null,
    Number(price) || 0,
    image_url || null,
    available === false ? 0 : 1
  );
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { name, description, price, image_url, available } = req.body || {};
  db.prepare(`
    UPDATE items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      image_url = COALESCE(?, image_url),
      available = COALESCE(?, available)
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    price !== undefined ? Number(price) : null,
    image_url ?? null,
    available === undefined ? null : (available ? 1 : 0),
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
