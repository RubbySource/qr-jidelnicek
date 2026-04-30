const express = require('express');
const db = require('../db');
const { toNum } = require('../db');
const { requireAuth } = require('../auth');
const { ITEM_COLUMNS, FLAG_FIELDS, normalizeItem, serializeAllergens } = require('../menu');

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
    SELECT i.id, i.category_id FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN menus m ON m.id = c.menu_id
    WHERE i.id = ? AND m.restaurant_id = ?
  `).get(itemId, restaurantId);
}

function flagValue(v) {
  if (v === undefined || v === null) return null;
  return v ? 1 : 0;
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
    `SELECT ${ITEM_COLUMNS} FROM items WHERE category_id = ? ORDER BY "order" ASC, id ASC`
  );

  res.json({
    menu,
    categories: categories.map((c) => ({
      ...c,
      items: itemStmt.all(c.id).map(normalizeItem),
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
    : (db.prepare('SELECT COUNT(*) as c FROM categories WHERE menu_id = ?').get(menu.id).c || 0);
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

router.delete('/categories/:id', (req, res) => {
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/categories/:id/move', (req, res) => {
  const direction = req.body?.direction;
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'direction must be "up" or "down"' });
  }
  if (!ownsCategory(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });

  const menu = getDefaultMenu(req.user.id);
  const all = db.prepare(
    'SELECT id, "order" FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(menu.id);
  const idx = all.findIndex((c) => c.id == req.params.id);
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= all.length) return res.json({ ok: true });

  // Re-number every row to give us a consistent base, then swap.
  const txn = db.prepare('UPDATE categories SET "order" = ? WHERE id = ?');
  const newList = [...all];
  [newList[idx], newList[swapWith]] = [newList[swapWith], newList[idx]];
  newList.forEach((row, i) => txn.run(i, row.id));
  res.json({ ok: true });
});

router.post('/items', (req, res) => {
  const {
    category_id, name, description, price, image_url, available,
    is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens,
  } = req.body || {};
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
  if (!ownsCategory(req.user.id, category_id)) return res.status(403).json({ error: 'forbidden' });

  const nextOrder = db.prepare(
    'SELECT COUNT(*) as c FROM items WHERE category_id = ?'
  ).get(category_id).c || 0;

  const result = db.prepare(`
    INSERT INTO items (
      category_id, name, description, price, image_url, available, "order",
      is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category_id,
    name,
    description || null,
    Number(price) || 0,
    image_url || null,
    available === false ? 0 : 1,
    nextOrder,
    is_vegetarian ? 1 : 0,
    is_vegan ? 1 : 0,
    is_gluten_free ? 1 : 0,
    is_lactose_free ? 1 : 0,
    is_spicy ? 1 : 0,
    is_featured ? 1 : 0,
    serializeAllergens(allergens),
  );
  res.status(201).json({ id: toNum(result.lastInsertRowid) });
});

router.put('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const {
    name, description, price, image_url, available,
    is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens,
  } = req.body || {};
  db.prepare(`
    UPDATE items SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      price = COALESCE(?, price),
      image_url = COALESCE(?, image_url),
      available = COALESCE(?, available),
      is_vegetarian = COALESCE(?, is_vegetarian),
      is_vegan = COALESCE(?, is_vegan),
      is_gluten_free = COALESCE(?, is_gluten_free),
      is_lactose_free = COALESCE(?, is_lactose_free),
      is_spicy = COALESCE(?, is_spicy),
      is_featured = COALESCE(?, is_featured),
      allergens = COALESCE(?, allergens)
    WHERE id = ?
  `).run(
    name ?? null,
    description ?? null,
    price !== undefined ? Number(price) : null,
    image_url ?? null,
    available === undefined ? null : (available ? 1 : 0),
    flagValue(is_vegetarian),
    flagValue(is_vegan),
    flagValue(is_gluten_free),
    flagValue(is_lactose_free),
    flagValue(is_spicy),
    flagValue(is_featured),
    allergens === undefined ? null : (serializeAllergens(allergens) ?? ''),
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/items/:id/move', (req, res) => {
  const direction = req.body?.direction;
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'direction must be "up" or "down"' });
  }
  const owned = ownsItem(req.user.id, req.params.id);
  if (!owned) return res.status(404).json({ error: 'not found' });

  const all = db.prepare(
    'SELECT id, "order" FROM items WHERE category_id = ? ORDER BY "order" ASC, id ASC'
  ).all(owned.category_id);
  const idx = all.findIndex((c) => c.id == req.params.id);
  const swapWith = direction === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= all.length) return res.json({ ok: true });

  const stmt = db.prepare('UPDATE items SET "order" = ? WHERE id = ?');
  const newList = [...all];
  [newList[idx], newList[swapWith]] = [newList[swapWith], newList[idx]];
  newList.forEach((row, i) => stmt.run(i, row.id));
  res.json({ ok: true });
});

router.post('/seed-demo', (req, res) => {
  const menu = getDefaultMenu(req.user.id);
  if (!menu) return res.status(400).json({ error: 'no active menu' });

  const existing = db.prepare(
    'SELECT COUNT(*) as c FROM categories WHERE menu_id = ?'
  ).get(menu.id).c;
  if (existing > 0) {
    return res.status(409).json({ error: 'menu is not empty — seed only works on a fresh menu' });
  }

  const insertCat = db.prepare(
    'INSERT INTO categories (menu_id, name, "order") VALUES (?, ?, ?)'
  );
  const insertItem = db.prepare(`
    INSERT INTO items (
      category_id, name, description, price, available, "order",
      is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
    ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Czech-ish demo menu — covers different dietary tags so filtering looks meaningful.
  const demo = [
    {
      name: 'Předkrmy',
      items: [
        ['Bramboračka', 'S houbami a majoránkou', 79, { veg: 1, allergens: '1,9' }],
        ['Bruschetta', 'Rajče, bazalka, česnek, olivový olej', 89, { veg: 1, vegan: 1, allergens: '1' }],
        ['Domácí paštika', 'S brusinkami a opečeným chlebem', 119, { allergens: '1,3,7' }],
      ],
    },
    {
      name: 'Hlavní jídla',
      items: [
        ['Svíčková na smetaně', 'S houskovým knedlíkem (5 ks)', 219, { featured: 1, allergens: '1,3,7,9' }],
        ['Smažený sýr', 'S vařeným bramborem a tatarkou', 189, { veg: 1, allergens: '1,3,7' }],
        ['Grilovaný losos', 'Se zeleninou a citronem', 295, { featured: 1, gf: 1, lf: 1, allergens: '4' }],
        ['Pikantní kuřecí kari', 'S basmati rýží', 219, { spicy: 1, gf: 1, allergens: '7' }],
        ['Vegan burger', 'Cizrnová placka, salát, avokádo, hranolky', 199, { veg: 1, vegan: 1, allergens: '1,11' }],
      ],
    },
    {
      name: 'Dezerty',
      items: [
        ['Domácí čokoládový dort', 'S vanilkovou zmrzlinou', 119, { veg: 1, allergens: '1,3,7,8' }],
        ['Sorbet z lesního ovoce', 'Bez laktózy, bez lepku', 89, { veg: 1, vegan: 1, gf: 1, lf: 1 }],
      ],
    },
    {
      name: 'Nápoje',
      items: [
        ['Pilsner Urquell 0,5 l', null, 59, { veg: 1, vegan: 1, gf: 0, allergens: '1' }],
        ['Domácí limonáda', 'Citron, máta, led', 69, { veg: 1, vegan: 1, gf: 1, lf: 1 }],
        ['Espresso', null, 49, { veg: 1, vegan: 1, gf: 1, lf: 1 }],
      ],
    },
  ];

  let catOrder = 0;
  for (const cat of demo) {
    const catId = toNum(insertCat.run(menu.id, cat.name, catOrder++).lastInsertRowid);
    let itemOrder = 0;
    for (const [name, description, price, flags] of cat.items) {
      insertItem.run(
        catId, name, description, price, itemOrder++,
        flags.veg ? 1 : 0,
        flags.vegan ? 1 : 0,
        flags.gf ? 1 : 0,
        flags.lf ? 1 : 0,
        flags.spicy ? 1 : 0,
        flags.featured ? 1 : 0,
        flags.allergens || null,
      );
    }
  }

  res.json({ ok: true });
});

module.exports = router;
