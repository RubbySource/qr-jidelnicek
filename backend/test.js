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
    env: { ...process.env, PORT: String(PORT), DB_PATH: TMP_DB, JWT_SECRET: 'test-secret' },
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
