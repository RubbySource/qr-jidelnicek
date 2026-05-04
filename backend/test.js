const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const PORT = process.env.TEST_PORT || 4011;
const BASE = `http://localhost:${PORT}`;
const TMP_DB = path.join(os.tmpdir(), `qr-jidelnicek-test-${Date.now()}.sqlite`);

let pass = 0;
let fail = 0;
const failures = [];

function assert(cond, label) {
  if (cond) {
    pass++;
    console.log(`  ok  - ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  FAIL - ${label}`);
  }
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init);
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

function waitForServer(timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (async function poll() {
      try {
        const r = await fetch(`${BASE}/api/health`);
        if (r.ok) return resolve();
      } catch {}
      if (Date.now() - start > timeoutMs) {
        return reject(new Error('server did not start in time'));
      }
      setTimeout(poll, 100);
    })();
  });
}

async function run() {
  console.log(`Starting server on port ${PORT} with DB=${TMP_DB}`);
  const server = spawn(process.execPath, [path.join(__dirname, 'src', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH: TMP_DB,
      JWT_SECRET: 'test-secret',
      DISABLE_RATE_LIMIT: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  const cleanup = () => {
    try { server.kill('SIGTERM'); } catch {}
    try { fs.unlinkSync(TMP_DB); } catch {}
    try { fs.unlinkSync(`${TMP_DB}-shm`); } catch {}
    try { fs.unlinkSync(`${TMP_DB}-wal`); } catch {}
  };

  try {
    await waitForServer();

    // 1. health
    {
      const { status, body } = await fetchJson(`${BASE}/api/health`);
      assert(status === 200, 'GET /api/health returns 200');
      assert(body && body.ok === true, 'GET /api/health returns { ok: true }');
    }

    // 2. register
    const email = `test-${Date.now()}@example.com`;
    const password = 'pass1234';
    let token = null;
    let slug = null;
    {
      const { status, body } = await fetchJson(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Restaurant', email, password, slug: 'test-restaurant' }),
      });
      assert(status === 201, 'POST /api/auth/register returns 201');
      assert(body && typeof body.token === 'string', 'register returns JWT token');
      assert(body && body.restaurant && body.restaurant.slug, 'register returns restaurant.slug');
      token = body && body.token;
      slug = body && body.restaurant && body.restaurant.slug;
    }

    // 2b. duplicate email -> 409
    {
      const { status } = await fetchJson(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Other', email, password, slug: 'other-slug' }),
      });
      assert(status === 409, 'POST /api/auth/register with existing email returns 409');
    }

    // 3. login
    {
      const { status, body } = await fetchJson(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert(status === 200, 'POST /api/auth/login returns 200');
      assert(body && typeof body.token === 'string', 'login returns JWT token');
    }

    // 3b. wrong password -> 401
    {
      const { status } = await fetchJson(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrong' }),
      });
      assert(status === 401, 'POST /api/auth/login with wrong password returns 401');
    }

    // 4. public menu by slug
    {
      const { status, body } = await fetchJson(`${BASE}/api/menu/${slug}`);
      assert(status === 200, `GET /api/menu/${slug} returns 200`);
      assert(body && body.restaurant && body.restaurant.slug === slug, 'menu returns restaurant');
      assert(Array.isArray(body && body.categories), 'menu returns categories array');
    }

    // 4b. unknown slug -> 404
    {
      const { status } = await fetchJson(`${BASE}/api/menu/this-slug-does-not-exist-xyz`);
      assert(status === 404, 'GET /api/menu/<unknown> returns 404');
    }

    // 5. admin /me with token
    {
      const { status, body } = await fetchJson(`${BASE}/api/admin/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(status === 200, 'GET /api/admin/me with token returns 200');
      assert(body && body.email === email, 'admin/me returns own email');
    }

    // 5b. admin without token -> 401
    {
      const { status } = await fetchJson(`${BASE}/api/admin/me`);
      assert(status === 401, 'GET /api/admin/me without token returns 401');
    }

    // 6. QR generation
    {
      const r = await fetch(`${BASE}/api/qr/${slug}`);
      const ct = r.headers.get('content-type') || '';
      assert(r.status === 200, 'GET /api/qr/:slug returns 200');
      assert(ct.includes('image/png'), 'GET /api/qr/:slug returns image/png');
    }

    // 6b. QR SVG / PDF
    {
      const svg = await fetch(`${BASE}/api/qr/${slug}?format=svg`);
      assert(svg.status === 200 && (svg.headers.get('content-type') || '').includes('image/svg'),
        'GET /api/qr/:slug?format=svg returns image/svg+xml');
      const pdf = await fetch(`${BASE}/api/qr/${slug}?format=pdf`);
      assert(pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('application/pdf'),
        'GET /api/qr/:slug?format=pdf returns application/pdf');
    }

    // 7. Seed demo + retrieve dietary flags + allergens via admin
    let categoryId = null;
    {
      const seed = await fetchJson(`${BASE}/api/admin/seed-demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      assert(seed.status === 200 && seed.body && seed.body.ok === true, 'POST /api/admin/seed-demo returns ok');

      const adminMenu = await fetchJson(`${BASE}/api/admin/menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      assert(adminMenu.status === 200 && Array.isArray(adminMenu.body.categories) && adminMenu.body.categories.length > 0,
        'admin/menu returns seeded categories');
      categoryId = adminMenu.body.categories[0].id;
      const firstCat = adminMenu.body.categories[0];
      const someItem = firstCat.items[0];
      assert(typeof someItem.is_vegetarian === 'boolean', 'item has boolean is_vegetarian flag');
      assert(Array.isArray(someItem.allergens), 'item has allergens array');
    }

    // 8. Public menu returns dietary flags + allergens
    {
      const r = await fetchJson(`${BASE}/api/menu/${slug}`);
      assert(r.status === 200, 'public menu returns 200');
      const cat = r.body.categories[0];
      const it = cat.items[0];
      assert(typeof it.is_vegetarian === 'boolean', 'public item has boolean is_vegetarian');
      assert(Array.isArray(it.allergens), 'public item has allergens array');
    }

    // 9. Create custom item with flags + allergens
    if (categoryId) {
      const createRes = await fetchJson(`${BASE}/api/admin/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          category_id: categoryId,
          name: 'Test pikantní vegan jídlo',
          price: 199,
          is_vegan: true,
          is_spicy: true,
          is_featured: true,
          allergens: ['1', '7', '99'],  // 99 should be filtered out
        }),
      });
      assert(createRes.status === 201 && createRes.body && typeof createRes.body.id === 'number',
        'POST /api/admin/items with flags+allergens returns 201');

      const reload = await fetchJson(`${BASE}/api/admin/menu`, { headers: { Authorization: `Bearer ${token}` } });
      const newItem = reload.body.categories
        .flatMap((c) => c.items)
        .find((it) => it.id === createRes.body.id);
      assert(!!newItem && newItem.is_vegan === true && newItem.is_spicy === true && newItem.is_featured === true,
        'created item retains flags');
      assert(!!newItem && Array.isArray(newItem.allergens) && newItem.allergens.includes('1') && newItem.allergens.includes('7') && !newItem.allergens.includes('99'),
        'allergens are validated against EU 1-14');
    }

    // 10. Move endpoints
    if (categoryId) {
      const r = await fetchJson(`${BASE}/api/admin/categories/${categoryId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ direction: 'down' }),
      });
      assert(r.status === 200, 'POST /api/admin/categories/:id/move returns 200');
    }

    // 11. Restaurant profile update + propagation to public menu
    {
      const upd = await fetchJson(`${BASE}/api/admin/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: '+420 123 456 789',
          address: 'Václavské náměstí 1, Praha 1',
          opening_hours: 'Po-Pá: 11-22\nSo-Ne: 12-23',
          website_url: 'https://example.cz',
        }),
      });
      assert(upd.status === 200 && upd.body && upd.body.phone === '+420 123 456 789',
        'PUT /api/admin/profile updates and returns profile');

      const pub = await fetchJson(`${BASE}/api/menu/${slug}`);
      assert(pub.status === 200 && pub.body.restaurant.phone === '+420 123 456 789' && pub.body.restaurant.address.startsWith('Václavské'),
        'public menu returns restaurant profile fields');
    }
  } finally {
    cleanup();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
