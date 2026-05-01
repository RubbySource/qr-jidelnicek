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
    SELECT c.id, c.menu_id FROM categories c
    JOIN menus m ON m.id = c.menu_id
    WHERE c.id = ? AND m.restaurant_id = ?
  `).get(categoryId, restaurantId);
}

function ownsItem(restaurantId, itemId) {
  return db.prepare(`
    SELECT i.id, i.category_id, i.position FROM items i
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
    'SELECT id, name, description, price, image_url, available, position, name_en, description_en FROM items WHERE category_id = ? ORDER BY position ASC, id ASC'
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
  const nextOrder = Number.isFinite(order)
    ? order
    : (db.prepare('SELECT COALESCE(MAX("order") + 1, 0) AS n FROM categories WHERE menu_id = ?').get(menu.id).n);
  const result = db.prepare(
    'INSERT INTO categories (menu_id, name, "order") VALUES (?, ?, ?)'
  ).run(menu.id, name, nextOrder);
  res.status(201).json({ id: toNum(result.lastInsertRowid), name, order: nextOrder });
});

router.put('/categories/:id', (req, res) => {
  const { name, order } = req.body || {};
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('UPDATE categories SET name = COALESCE(?, name), "order" = COALESCE(?, "order") WHERE id = ?')
    .run(name ?? null, Number.isFinite(order) ? order : null, req.params.id);
  res.json({ ok: true });
});

router.put('/categories/:id/order', (req, res) => {
  const { position } = req.body || {};
  if (!Number.isFinite(position)) return res.status(400).json({ error: 'position is required' });
  const cat = ownsCategory(req.user.id, req.params.id);
  if (!cat) return res.status(404).json({ error: 'not found' });

  const all = db.prepare(
    'SELECT id FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(cat.menu_id);
  const ids = all.map((r) => r.id).filter((id) => id !== Number(req.params.id));
  const target = Math.max(0, Math.min(Math.floor(position), ids.length));
  ids.splice(target, 0, Number(req.params.id));

  const upd = db.prepare('UPDATE categories SET "order" = ? WHERE id = ?');
  const tx = db.transaction((list) => {
    list.forEach((id, idx) => upd.run(idx, id));
  });
  tx(ids);
  res.json({ ok: true });
});

router.delete('/categories/:id', (req, res) => {
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/items', (req, res) => {
  const { category_id, name, description, price, image_url, available, name_en, description_en } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
  if (!ownsCategory(req.user.id, category_id)) return res.status(403).json({ error: 'forbidden' });

  const nextPos = db.prepare(
    'SELECT COALESCE(MAX(position) + 1, 0) AS n FROM items WHERE category_id = ?'
  ).get(category_id).n;

  const result = db.prepare(`
    INSERT INTO items (category_id, name, description, price, image_url, available, position, name_en, description_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category_id,
    name,
    description || null,
    Number(price) || 0,
    image_url || null,
    available === false ? 0 : 1,
    nextPos,
    name_en ? String(name_en) : null,
    description_en ? String(description_en) : null
  );
  res.status(201).json({ id: toNum(result.lastInsertRowid), position: nextPos });
});

router.put('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { name, description, price, image_url, available, name_en, description_en } = req.body || {};
  db.prepare(`
    UPDATE items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      image_url = COALESCE(?, image_url),
      available = COALESCE(?, available),
      name_en = CASE WHEN ? = 1 THEN ? ELSE name_en END,
      description_en = CASE WHEN ? = 1 THEN ? ELSE description_en END
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    price !== undefined ? Number(price) : null,
    image_url ?? null,
    available === undefined ? null : (available ? 1 : 0),
    name_en !== undefined ? 1 : 0,
    name_en ? String(name_en) : null,
    description_en !== undefined ? 1 : 0,
    description_en ? String(description_en) : null,
    req.params.id
  );
  res.json({ ok: true });
});

router.put('/items/:id/order', (req, res) => {
  const { position } = req.body || {};
  if (!Number.isFinite(position)) return res.status(400).json({ error: 'position is required' });
  const item = ownsItem(req.user.id, req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });

  const all = db.prepare(
    'SELECT id FROM items WHERE category_id = ? ORDER BY position ASC, id ASC'
  ).all(item.category_id);
  const ids = all.map((r) => r.id).filter((id) => id !== Number(req.params.id));
  const target = Math.max(0, Math.min(Math.floor(position), ids.length));
  ids.splice(target, 0, Number(req.params.id));

  const upd = db.prepare('UPDATE items SET position = ? WHERE id = ?');
  const tx = db.transaction((list) => {
    list.forEach((id, idx) => upd.run(idx, id));
  });
  tx(ids);
  res.json({ ok: true });
});

router.patch('/items/:id/availability', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const { available } = req.body || {};
  if (typeof available !== 'boolean') return res.status(400).json({ error: 'available must be boolean' });
  db.prepare('UPDATE items SET available = ? WHERE id = ?').run(available ? 1 : 0, req.params.id);
  res.json({ ok: true, available });
});

router.delete('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
