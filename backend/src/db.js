const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.sqlite');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'trial',
    stripe_customer_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS menus (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    image_url TEXT,
    available INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_menus_restaurant ON menus(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_categories_menu ON categories(menu_id);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
`);

const itemCols = db.prepare("PRAGMA table_info(items)").all();
if (!itemCols.some((c) => c.name === 'position')) {
  db.exec('ALTER TABLE items ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE items SET position = (
      SELECT COUNT(*) FROM items i2
      WHERE i2.category_id = items.category_id AND i2.id < items.id
    )
  `);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_items_position ON items(category_id, position)');

function toNum(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}

module.exports = db;
module.exports.toNum = toNum;
