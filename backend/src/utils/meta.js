const db = require('../db');

// via.placeholder.com is offline as of 2024 — placehold.co is its actively maintained successor.
const PLACEHOLDER_IMAGE = 'https://placehold.co/1200x630/2d5a27/f5f0e8/png?text=QR+J%C3%ADdeln%C3%AD%C4%8Dek';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findRestaurantBySlug(slug) {
  if (!slug) return null;
  const cols = db.prepare('PRAGMA table_info(restaurants)').all();
  const hasCustomSlug = cols.some((c) => c.name === 'custom_slug');
  if (hasCustomSlug) {
    const byCustom = db
      .prepare('SELECT id, name, slug FROM restaurants WHERE custom_slug = ?')
      .get(slug);
    if (byCustom) return byCustom;
  }
  return db.prepare('SELECT id, name, slug FROM restaurants WHERE slug = ?').get(slug);
}

function pickFirstItemImage(restaurantId) {
  // Skip base64 data URLs — Facebook/Twitter scrapers can't fetch them.
  const row = db
    .prepare(
      `SELECT i.image_url AS image_url
       FROM items i
       JOIN categories c ON c.id = i.category_id
       JOIN menus m ON m.id = c.menu_id
       WHERE m.restaurant_id = ?
         AND m.active = 1
         AND i.image_url IS NOT NULL
         AND i.image_url <> ''
         AND i.image_url NOT LIKE 'data:%'
       ORDER BY c."order" ASC, i.position ASC, i.id ASC
       LIMIT 1`
    )
    .get(restaurantId);
  return row && row.image_url ? row.image_url : null;
}

function buildMetaHtml(restaurant, baseUrl) {
  if (!restaurant) return '';
  const cleanBase = (baseUrl || '').replace(/\/$/, '');
  const url = `${cleanBase}/menu/${restaurant.slug}`;
  const title = `${restaurant.name} — Jídelní lístek`;
  const description = `Aktuální jídelní lístek restaurace ${restaurant.name}. Naskenujte QR kód a prohlédněte si nabídku.`;
  const image = pickFirstItemImage(restaurant.id) || PLACEHOLDER_IMAGE;

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
  ].join('\n    ');
}

function injectMetaIntoHtml(html, metaHtml) {
  if (!metaHtml) return html;
  const stripped = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+(name|property)=["'](description|og:[^"']+|twitter:[^"']+)["'][^>]*>\s*/gi, '');
  return stripped.replace(/<head([^>]*)>/i, (match) => `${match}\n    ${metaHtml}`);
}

module.exports = {
  buildMetaHtml,
  injectMetaIntoHtml,
  findRestaurantBySlug,
};
