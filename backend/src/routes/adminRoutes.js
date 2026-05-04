const express = require('express');
const db = require('../db');
const { toNum } = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

router.use(requireAuth);

const ITEM_FLAG_FIELDS = ['is_vegetarian', 'is_vegan', 'is_gluten_free', 'is_lactose_free', 'is_spicy', 'is_featured'];
const ALLERGEN_CODES = new Set(['1','2','3','4','5','6','7','8','9','10','11','12','13','14']);

function parseAllergens(raw) {
  if (raw == null) return null;
  let arr = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { arr = []; }
  }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const v of arr) {
    const code = String(v).trim();
    if (ALLERGEN_CODES.has(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

function decodeAllergens(stored) {
  if (!stored) return [];
  try {
    const arr = JSON.parse(stored);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function bool01(v) {
  if (v === undefined || v === null) return null;
  return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
}

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

router.get('/analytics', (req, res) => {
  const restaurantId = req.user.id;

  const total7d = toNum(db.prepare(`
    SELECT COUNT(*) AS n FROM menu_views
    WHERE restaurant_id = ? AND viewed_at >= datetime('now', '-7 days')
  `).get(restaurantId).n);

  const total30d = toNum(db.prepare(`
    SELECT COUNT(*) AS n FROM menu_views
    WHERE restaurant_id = ? AND viewed_at >= datetime('now', '-30 days')
  `).get(restaurantId).n);

  const byDayRows = db.prepare(`
    SELECT date(viewed_at) AS date, COUNT(*) AS count
    FROM menu_views
    WHERE restaurant_id = ? AND viewed_at >= date('now', '-6 days')
    GROUP BY date(viewed_at)
  `).all(restaurantId);

  const byDayMap = new Map(byDayRows.map((r) => [r.date, toNum(r.count)]));
  const views_by_day = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    views_by_day.push({ date, count: byDayMap.get(date) || 0 });
  }

  const top_items = db.prepare(`
    SELECT i.name FROM items i
    JOIN categories c ON c.id = i.category_id
    JOIN menus m ON m.id = c.menu_id
    WHERE m.restaurant_id = ? AND m.active = 1
    ORDER BY c."order" ASC, i.position ASC, i.id ASC
    LIMIT 5
  `).all(restaurantId).map((r) => ({ name: r.name, view_count: total30d }));

  res.json({
    total_views_7d: total7d,
    total_views_30d: total30d,
    views_by_day,
    top_items,
  });
});

router.get('/me', (req, res) => {
  const r = db.prepare(
    `SELECT id, name, slug, custom_slug, email, plan, created_at,
            logo_url, phone, address, opening_hours, website_url
     FROM restaurants WHERE id = ?`
  ).get(req.user.id);
  if (!r) return res.status(404).json({ error: 'not found' });
  res.json(r);
});

router.put('/profile', (req, res) => {
  const body = req.body || {};
  const sets = [];
  const vals = [];
  if (body.name !== undefined) {
    const n = String(body.name).trim();
    if (n.length === 0 || n.length > 120) return res.status(400).json({ error: 'name must be 1-120 chars' });
    sets.push('name = ?'); vals.push(n);
  }
  for (const f of ['logo_url', 'phone', 'address', 'opening_hours', 'website_url']) {
    if (body[f] !== undefined) {
      const v = body[f] == null ? null : String(body[f]).trim();
      sets.push(`${f} = ?`); vals.push(v && v.length > 0 ? v.slice(0, 4096) : null);
    }
  }
  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.user.id);
  db.prepare(`UPDATE restaurants SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
  const r = db.prepare(
    `SELECT id, name, slug, custom_slug, email, plan, created_at,
            logo_url, phone, address, opening_hours, website_url
     FROM restaurants WHERE id = ?`
  ).get(req.user.id);
  res.json(r);
});

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

router.put('/restaurants/:id/slug', (req, res) => {
  if (Number(req.params.id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const raw = (req.body && req.body.slug) ?? '';
  const slug = String(raw).trim().toLowerCase();
  if (slug.length < 3 || slug.length > 40) {
    return res.status(400).json({ error: 'Slug musí mít 3 až 40 znaků.' });
  }
  if (!SLUG_RE.test(slug)) {
    return res.status(400).json({ error: 'Slug může obsahovat jen malá písmena a-z, čísla 0-9 a pomlčky.' });
  }
  const taken = db.prepare(
    'SELECT id FROM restaurants WHERE (custom_slug = ? OR slug = ?) AND id != ?'
  ).get(slug, slug, req.user.id);
  if (taken) {
    return res.status(409).json({ error: 'Tento slug už je obsazený.' });
  }
  try {
    db.prepare('UPDATE restaurants SET custom_slug = ? WHERE id = ?').run(slug, req.user.id);
  } catch (err) {
    if (String(err.message || '').toLowerCase().includes('unique')) {
      return res.status(409).json({ error: 'Tento slug už je obsazený.' });
    }
    throw err;
  }
  res.json({ slug });
});

router.get('/menu', (req, res) => {
  const menu = getDefaultMenu(req.user.id);
  if (!menu) return res.json({ menu: null, categories: [] });

  const categories = db.prepare(
    'SELECT id, name, "order" FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(menu.id);

  const itemStmt = db.prepare(
    `SELECT id, name, description, price, image_url, available, position, name_en, description_en,
            is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
     FROM items WHERE category_id = ? ORDER BY position ASC, id ASC`
  );

  res.json({
    menu,
    categories: categories.map((c) => ({
      ...c,
      items: itemStmt.all(c.id).map((it) => ({
        ...it,
        available: !!it.available,
        is_vegetarian: !!it.is_vegetarian,
        is_vegan: !!it.is_vegan,
        is_gluten_free: !!it.is_gluten_free,
        is_lactose_free: !!it.is_lactose_free,
        is_spicy: !!it.is_spicy,
        is_featured: !!it.is_featured,
        allergens: decodeAllergens(it.allergens),
      })),
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
  const body = req.body || {};
  const { category_id, name, description, price, image_url, available, name_en, description_en } = body;
  if (!category_id || !name) return res.status(400).json({ error: 'category_id and name are required' });
  if (!ownsCategory(req.user.id, category_id)) return res.status(403).json({ error: 'forbidden' });

  const nextPos = db.prepare(
    'SELECT COALESCE(MAX(position) + 1, 0) AS n FROM items WHERE category_id = ?'
  ).get(category_id).n;

  const allergens = parseAllergens(body.allergens) || [];

  const result = db.prepare(`
    INSERT INTO items (
      category_id, name, description, price, image_url, available, position, name_en, description_en,
      is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    category_id,
    name,
    description || null,
    Number(price) || 0,
    image_url || null,
    available === false ? 0 : 1,
    nextPos,
    name_en ? String(name_en) : null,
    description_en ? String(description_en) : null,
    bool01(body.is_vegetarian) || 0,
    bool01(body.is_vegan) || 0,
    bool01(body.is_gluten_free) || 0,
    bool01(body.is_lactose_free) || 0,
    bool01(body.is_spicy) || 0,
    bool01(body.is_featured) || 0,
    JSON.stringify(allergens)
  );
  res.status(201).json({ id: toNum(result.lastInsertRowid), position: nextPos });
});

router.put('/items/:id', (req, res) => {
  if (!ownsItem(req.user.id, req.params.id)) return res.status(404).json({ error: 'not found' });
  const body = req.body || {};
  const { name, description, price, image_url, available, name_en, description_en } = body;

  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(String(name)); }
  if (description !== undefined) { sets.push('description = ?'); vals.push(description == null ? null : String(description)); }
  if (price !== undefined) { sets.push('price = ?'); vals.push(Number(price) || 0); }
  if (image_url !== undefined) { sets.push('image_url = ?'); vals.push(image_url || null); }
  if (available !== undefined) { sets.push('available = ?'); vals.push(available ? 1 : 0); }
  if (name_en !== undefined) { sets.push('name_en = ?'); vals.push(name_en ? String(name_en) : null); }
  if (description_en !== undefined) { sets.push('description_en = ?'); vals.push(description_en ? String(description_en) : null); }
  for (const f of ITEM_FLAG_FIELDS) {
    if (body[f] !== undefined) { sets.push(`${f} = ?`); vals.push(bool01(body[f])); }
  }
  if (body.allergens !== undefined) {
    sets.push('allergens = ?');
    vals.push(JSON.stringify(parseAllergens(body.allergens) || []));
  }

  if (sets.length === 0) return res.json({ ok: true });
  vals.push(req.params.id);
  db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
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

router.post('/categories/:id/move', (req, res) => {
  const { direction } = req.body || {};
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'direction must be "up" or "down"' });
  }
  const cat = ownsCategory(req.user.id, req.params.id);
  if (!cat) return res.status(404).json({ error: 'not found' });

  const all = db.prepare(
    'SELECT id FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(cat.menu_id).map((r) => r.id);
  const idx = all.indexOf(Number(req.params.id));
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || target < 0 || target >= all.length) return res.json({ ok: true, moved: false });
  [all[idx], all[target]] = [all[target], all[idx]];

  const upd = db.prepare('UPDATE categories SET "order" = ? WHERE id = ?');
  db.transaction((list) => list.forEach((id, i) => upd.run(i, id)))(all);
  res.json({ ok: true, moved: true });
});

router.post('/items/:id/move', (req, res) => {
  const { direction } = req.body || {};
  if (direction !== 'up' && direction !== 'down') {
    return res.status(400).json({ error: 'direction must be "up" or "down"' });
  }
  const item = ownsItem(req.user.id, req.params.id);
  if (!item) return res.status(404).json({ error: 'not found' });

  const all = db.prepare(
    'SELECT id FROM items WHERE category_id = ? ORDER BY position ASC, id ASC'
  ).all(item.category_id).map((r) => r.id);
  const idx = all.indexOf(Number(req.params.id));
  const target = direction === 'up' ? idx - 1 : idx + 1;
  if (idx < 0 || target < 0 || target >= all.length) return res.json({ ok: true, moved: false });
  [all[idx], all[target]] = [all[target], all[idx]];

  const upd = db.prepare('UPDATE items SET position = ? WHERE id = ?');
  db.transaction((list) => list.forEach((id, i) => upd.run(i, id)))(all);
  res.json({ ok: true, moved: true });
});

const DEMO_DATA = [
  {
    name: 'Předkrmy', items: [
      { name: 'Hovězí carpaccio', name_en: 'Beef carpaccio', description: 'S parmazánem a rukolou', description_en: 'With parmesan and arugula', price: 219, allergens: ['1', '7'], is_featured: 1, is_lactose_free: 0 },
      { name: 'Salát Caprese', name_en: 'Caprese salad', description: 'Buvolí mozzarella, rajčata, bazalka', description_en: 'Buffalo mozzarella, tomatoes, basil', price: 189, allergens: ['7'], is_vegetarian: 1, is_gluten_free: 1 },
      { name: 'Bruschetta', name_en: 'Bruschetta', description: 'S rajčaty a česnekem', description_en: 'With tomatoes and garlic', price: 149, allergens: ['1'], is_vegetarian: 1, is_vegan: 1 },
    ],
  },
  {
    name: 'Polévky', items: [
      { name: 'Hovězí vývar', name_en: 'Beef broth', description: 'S játrovými knedlíčky a nudlemi', description_en: 'With liver dumplings and noodles', price: 89, allergens: ['1', '3', '9'] },
      { name: 'Krémová dýňová', name_en: 'Cream of pumpkin', description: 'Se semínky a smetanou', description_en: 'With seeds and cream', price: 99, allergens: ['7'], is_vegetarian: 1, is_gluten_free: 1 },
    ],
  },
  {
    name: 'Hlavní jídla', items: [
      { name: 'Svíčková na smetaně', name_en: 'Beef sirloin in cream sauce', description: 'S knedlíkem a brusinkami', description_en: 'With dumpling and cranberries', price: 269, allergens: ['1', '3', '7', '9'], is_featured: 1 },
      { name: 'Pečená kachna', name_en: 'Roast duck', description: 'Se zelím a knedlíkem', description_en: 'With cabbage and dumplings', price: 329, allergens: ['1', '3'] },
      { name: 'Smažený sýr', name_en: 'Fried cheese', description: 'S hranolkami a tatarskou omáčkou', description_en: 'With fries and tartar sauce', price: 199, allergens: ['1', '3', '7', '10'], is_vegetarian: 1 },
      { name: 'Risotto s houbami', name_en: 'Mushroom risotto', description: 'Carnaroli, lesní houby, parmazán', description_en: 'Carnaroli, forest mushrooms, parmesan', price: 249, allergens: ['7', '9'], is_vegetarian: 1, is_gluten_free: 1 },
      { name: 'Pikantní kuřecí curry', name_en: 'Spicy chicken curry', description: 'S basmati rýží', description_en: 'With basmati rice', price: 239, allergens: ['7'], is_spicy: 1, is_lactose_free: 0 },
    ],
  },
  {
    name: 'Dezerty', items: [
      { name: 'Domácí palačinky', name_en: 'Homemade crepes', description: 'S nutellou a šlehačkou', description_en: 'With Nutella and whipped cream', price: 129, allergens: ['1', '3', '7', '8'], is_vegetarian: 1 },
      { name: 'Tiramisu', name_en: 'Tiramisu', description: 'Klasické italské', description_en: 'Classic Italian', price: 119, allergens: ['1', '3', '7'], is_vegetarian: 1, is_featured: 1 },
    ],
  },
  {
    name: 'Nápoje', items: [
      { name: 'Pilsner Urquell 0,5l', name_en: 'Pilsner Urquell 0.5L', description: '', description_en: '', price: 65, allergens: ['1'] },
      { name: 'Domácí limonáda', name_en: 'Homemade lemonade', description: 'Citron, máta, zázvor', description_en: 'Lemon, mint, ginger', price: 89, allergens: [], is_vegan: 1, is_gluten_free: 1 },
      { name: 'Espresso', name_en: 'Espresso', description: '', description_en: '', price: 55, allergens: [], is_vegan: 1, is_gluten_free: 1 },
    ],
  },
];

router.post('/seed-demo', (req, res) => {
  const menu = getDefaultMenu(req.user.id);
  if (!menu) return res.status(400).json({ error: 'no active menu' });

  const existing = db.prepare('SELECT COUNT(*) AS n FROM categories WHERE menu_id = ?').get(menu.id).n;
  if (toNum(existing) > 0 && !req.body?.force) {
    return res.status(409).json({ error: 'menu_not_empty', message: 'Menu už obsahuje kategorie. Pošlete { force: true } pro přepsání.' });
  }
  if (req.body?.force) {
    db.prepare('DELETE FROM categories WHERE menu_id = ?').run(menu.id);
  }

  const insertCat = db.prepare('INSERT INTO categories (menu_id, name, "order") VALUES (?, ?, ?)');
  const insertItem = db.prepare(`
    INSERT INTO items (
      category_id, name, description, price, image_url, available, position, name_en, description_en,
      is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
    ) VALUES (?, ?, ?, ?, NULL, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    DEMO_DATA.forEach((cat, ci) => {
      const catRes = insertCat.run(menu.id, cat.name, ci);
      const catId = toNum(catRes.lastInsertRowid);
      cat.items.forEach((it, ii) => {
        insertItem.run(
          catId, it.name, it.description || null, it.price, ii,
          it.name_en || null, it.description_en || null,
          it.is_vegetarian ? 1 : 0,
          it.is_vegan ? 1 : 0,
          it.is_gluten_free ? 1 : 0,
          it.is_lactose_free ? 1 : 0,
          it.is_spicy ? 1 : 0,
          it.is_featured ? 1 : 0,
          JSON.stringify(it.allergens || [])
        );
      });
    });
  });
  tx();

  res.json({ ok: true, categories: DEMO_DATA.length, items: DEMO_DATA.reduce((n, c) => n + c.items.length, 0) });
});

module.exports = router;
