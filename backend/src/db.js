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
    stripe_subscription_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'trial',
    trial_expires_at TEXT,
    trial_reminder_sent INTEGER NOT NULL DEFAULT 0,
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

  CREATE TABLE IF NOT EXISTS menu_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
    user_agent TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_menus_restaurant ON menus(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_categories_menu ON categories(menu_id);
  CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
  CREATE INDEX IF NOT EXISTS idx_views_restaurant ON menu_views(restaurant_id);
  CREATE INDEX IF NOT EXISTS idx_views_viewed_at ON menu_views(viewed_at);

  CREATE TABLE IF NOT EXISTS password_resets (
    token_hash TEXT PRIMARY KEY,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_restaurant ON password_resets(restaurant_id);
`);

function hasColumn(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  return cols.some((c) => c.name === column);
}

if (!hasColumn('items', 'position')) {
  db.exec('ALTER TABLE items ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE items SET position = (
      SELECT COUNT(*) FROM items i2
      WHERE i2.category_id = items.category_id AND i2.id < items.id
    )
  `);
}
db.exec('CREATE INDEX IF NOT EXISTS idx_items_position ON items(category_id, position)');

if (!hasColumn('items', 'name_en')) {
  db.exec('ALTER TABLE items ADD COLUMN name_en TEXT DEFAULT NULL');
}
if (!hasColumn('items', 'description_en')) {
  db.exec('ALTER TABLE items ADD COLUMN description_en TEXT DEFAULT NULL');
}

const ITEM_FLAG_COLUMNS = [
  'is_vegetarian',
  'is_vegan',
  'is_gluten_free',
  'is_lactose_free',
  'is_spicy',
  'is_featured',
];
for (const col of ITEM_FLAG_COLUMNS) {
  if (!hasColumn('items', col)) {
    db.exec(`ALTER TABLE items ADD COLUMN ${col} INTEGER NOT NULL DEFAULT 0`);
  }
}
if (!hasColumn('items', 'allergens')) {
  db.exec("ALTER TABLE items ADD COLUMN allergens TEXT NOT NULL DEFAULT '[]'");
}

if (!hasColumn('restaurants', 'subscription_status')) {
  db.exec("ALTER TABLE restaurants ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'trial'");
}
if (!hasColumn('restaurants', 'trial_expires_at')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN trial_expires_at TEXT');
}
if (!hasColumn('restaurants', 'stripe_subscription_id')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN stripe_subscription_id TEXT');
}
if (!hasColumn('restaurants', 'trial_reminder_sent')) {
  db.exec('ALTER TABLE restaurants ADD COLUMN trial_reminder_sent INTEGER NOT NULL DEFAULT 0');
}
if (!hasColumn('restaurants', 'plan_expires_at')) {
  try {
    db.exec('ALTER TABLE restaurants ADD COLUMN plan_expires_at INTEGER');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}
if (!hasColumn('restaurants', 'custom_slug')) {
  try {
    // SQLite doesn't support ADD COLUMN with UNIQUE — add without constraint, then create index below
    db.exec('ALTER TABLE restaurants ADD COLUMN custom_slug TEXT');
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) {
      console.error('ALTER restaurants ADD custom_slug failed:', err);
    }
  }
}
const RESTAURANT_PROFILE_COLUMNS = [
  ['logo_url', 'TEXT'],
  ['phone', 'TEXT'],
  ['address', 'TEXT'],
  ['opening_hours', 'TEXT'],
  ['website_url', 'TEXT'],
];
for (const [col, type] of RESTAURANT_PROFILE_COLUMNS) {
  if (!hasColumn('restaurants', col)) {
    try {
      db.exec(`ALTER TABLE restaurants ADD COLUMN ${col} ${type}`);
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) {
        console.error(`ALTER restaurants ADD ${col} failed:`, err);
      }
    }
  }
}

// Only create index if the column actually exists now
if (hasColumn('restaurants', 'custom_slug')) {
  try {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_custom_slug ON restaurants(custom_slug) WHERE custom_slug IS NOT NULL');
  } catch (err) {
    console.error('idx_restaurants_custom_slug index failed:', err);
  }
}

function toNum(v) {
  return typeof v === 'bigint' ? Number(v) : v;
}

module.exports = db;
module.exports.toNum = toNum;
