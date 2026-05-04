const express = require('express');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const db = require('../db');

const router = express.Router();

const QR_OPTIONS = {
  color: { dark: '#1a1a2e', light: '#ffffff' },
  width: 512,
  margin: 2,
  errorCorrectionLevel: 'H',
};

const insertView = db.prepare(
  'INSERT INTO menu_views (restaurant_id, user_agent) VALUES (?, ?)'
);

router.get('/menu/:slug', (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'cs';

  const PROFILE_COLS = 'id, name, slug, logo_url, phone, address, opening_hours, website_url';
  let restaurant = db.prepare(
    `SELECT ${PROFILE_COLS} FROM restaurants WHERE custom_slug = ?`
  ).get(req.params.slug);
  if (!restaurant) {
    restaurant = db.prepare(
      `SELECT ${PROFILE_COLS} FROM restaurants WHERE slug = ?`
    ).get(req.params.slug);
  }
  if (!restaurant) return res.status(404).json({ error: 'restaurant not found' });

  try {
    insertView.run(restaurant.id, (req.headers['user-agent'] || '').slice(0, 500));
  } catch (err) {
    console.error('menu_views insert failed:', err);
  }

  const menu = db.prepare(
    'SELECT id, name FROM menus WHERE restaurant_id = ? AND active = 1 ORDER BY id ASC LIMIT 1'
  ).get(restaurant.id);
  if (!menu) return res.json({ restaurant, menu: null, categories: [], lang });

  const categories = db.prepare(
    'SELECT id, name, "order" FROM categories WHERE menu_id = ? ORDER BY "order" ASC, id ASC'
  ).all(menu.id);

  const itemStmt = db.prepare(
    `SELECT id, name, description, price, image_url, available, name_en, description_en,
            is_vegetarian, is_vegan, is_gluten_free, is_lactose_free, is_spicy, is_featured, allergens
     FROM items WHERE category_id = ? ORDER BY position ASC, id ASC`
  );

  const decodeAllergens = (s) => {
    if (!s) return [];
    try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; }
  };

  const result = categories.map((c) => ({
    ...c,
    items: itemStmt.all(c.id).map((it) => {
      const useEn = lang === 'en';
      const name = useEn && it.name_en ? it.name_en : it.name;
      const description = useEn && it.description_en ? it.description_en : it.description;
      return {
        id: it.id,
        name,
        description,
        price: it.price,
        image_url: it.image_url,
        available: !!it.available,
        is_vegetarian: !!it.is_vegetarian,
        is_vegan: !!it.is_vegan,
        is_gluten_free: !!it.is_gluten_free,
        is_lactose_free: !!it.is_lactose_free,
        is_spicy: !!it.is_spicy,
        is_featured: !!it.is_featured,
        allergens: decodeAllergens(it.allergens),
      };
    }),
  }));

  res.json({ restaurant, menu, categories: result, lang });
});

router.get('/qr/:slug', async (req, res) => {
  const restaurant = db.prepare(
    'SELECT id, name, slug FROM restaurants WHERE slug = ?'
  ).get(req.params.slug);
  if (!restaurant) return res.status(404).json({ error: 'restaurant not found' });

  const baseUrl = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
  const menuUrl = `${baseUrl.replace(/\/$/, '')}/menu/${req.params.slug}`;
  const format = (req.query.format || 'png').toString().toLowerCase();

  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(menuUrl, { ...QR_OPTIONS, type: 'svg' });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300');
      if (req.query.download) {
        res.setHeader('Content-Disposition', `attachment; filename="qr-${restaurant.slug}.svg"`);
      }
      return res.send(svg);
    }

    if (format === 'pdf') {
      const png = await QRCode.toBuffer(menuUrl, QR_OPTIONS);
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="qr-${restaurant.slug}.pdf"`);
      doc.pipe(res);

      const pageWidth = doc.page.width;
      const qrSize = 300;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 150;

      doc
        .fillColor('#1a1a2e')
        .fontSize(28)
        .font('Helvetica-Bold')
        .text(restaurant.name, 50, 80, { align: 'center', width: pageWidth - 100 });

      doc
        .fillColor('#6b7280')
        .fontSize(14)
        .font('Helvetica')
        .text('Naskenujte QR kód a prohlédněte si jídelní lístek', 50, 115, {
          align: 'center',
          width: pageWidth - 100,
        });

      doc.image(png, qrX, qrY, { width: qrSize, height: qrSize });

      doc
        .fillColor('#1a1a2e')
        .fontSize(12)
        .font('Helvetica')
        .text(menuUrl, 50, qrY + qrSize + 30, {
          align: 'center',
          width: pageWidth - 100,
          link: menuUrl,
          underline: true,
        });

      doc.end();
      return;
    }

    const png = await QRCode.toBuffer(menuUrl, QR_OPTIONS);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=300');
    if (req.query.download) {
      res.setHeader('Content-Disposition', `attachment; filename="qr-${restaurant.slug}.png"`);
    }
    res.send(png);
  } catch (err) {
    console.error('QR generation failed:', err);
    res.status(500).json({ error: 'failed to generate QR' });
  }
});

module.exports = router;
