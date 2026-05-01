# STATUS — QR Jidelnicek Pro

_Last updated: 2026-05-01 (backend stabilizace + smoke testy)_

## Backend — funguje ✅

- **Runtime:** Node.js v24.14.1 (WSL Ubuntu)
- **DB:** `node:sqlite` (built-in, experimental warning je očekávaný) — žádný native build, žádné `better-sqlite3`
- **Start:** `node src/server.js` → `QR Jidelnicek API listening on http://localhost:3001`
- **Schema init:** ON START — `restaurants`, `menus`, `categories`, `items` se vytvoří přes `CREATE TABLE IF NOT EXISTS`. WAL mode + `PRAGMA foreign_keys = ON`.
- **`npm install`:** ~3 s, 116 packages, 0 vulnerabilities. Žádné peer-dep warnings.

### Smoke testy — 18/18 ✅

Spuštění:

```bash
wsl -e bash -c "cd '/mnt/c/Users/Dell 5090/Documents/Claude/Projects/qr-jidelnicek/backend' && node test.js"
```

`backend/test.js` startuje server na izolovaném portu (`TEST_PORT=4011`) s dočasnou SQLite databází v `os.tmpdir()`, takže testy nezasahují produkční data. Po dokončení server killne a temp DB smaže.

Pokrytí:

| Endpoint | Případ | Očekáváno | Stav |
|---|---|---|---|
| `GET /api/health` | základní | 200 + `{ ok: true }` | ✅ |
| `POST /api/auth/register` | nový účet | 201 + JWT + restaurant | ✅ |
| `POST /api/auth/register` | duplicitní email | 409 | ✅ |
| `POST /api/auth/login` | správné heslo | 200 + JWT | ✅ |
| `POST /api/auth/login` | špatné heslo | 401 | ✅ |
| `GET /api/menu/:slug` | existující slug | 200 + restaurant + categories[] | ✅ |
| `GET /api/menu/:slug` | neexistující slug | 404 | ✅ |
| `GET /api/admin/me` | s tokenem | 200 + email | ✅ |
| `GET /api/admin/me` | bez tokenu | 401 | ✅ |
| `GET /api/qr/:slug` | existující slug | 200 + image/png | ✅ |

## Co stojí za poznámku

- Žádné runtime chyby — kód v `src/server.js`, `src/db.js`, `src/auth.js`, `src/routes/*` běží out-of-the-box.
- `node:sqlite` vyžaduje Node ≥ 22.5 (stable od Node 24). WSL prostředí má v24.14.1, takže OK. Pokud někdy pojede CI na starší verzi, přepnout na `better-sqlite3` nebo zvýšit Node.
- `JWT_SECRET` má v `auth.js` dev fallback `'dev-secret-change-me'` — pro produkci nastavit přes env.
- `bcryptjs` (čistá JS implementace) — žádný native build, funguje napříč Win/WSL/Linux.

## Frontend

Mimo scope této úlohy. Backend API je připraven, frontend volá `/api/*` na portu 3001 (CORS je povolen widely v `server.js`).

## Otevřené P1 (z předchozího auditu, stále platné)

- **CORS allowlist:** `app.use(cors())` v `backend/src/server.js` povoluje všechny originy. Pro produkci nastavit konkrétní frontend doménu.
- **Rate-limiting:** `/api/auth/login` a `/api/auth/register` nejsou nijak omezené → brute-force riziko. Doporučeno `express-rate-limit` (např. 10 pokusů/min na IP).
- **DB backup:** Railway Volume zachová SQLite mezi redeploys, ale strategie zálohy (cron + S3 / off-site) zatím není definovaná.
- **Validace vstupů:** backend přijímá `req.body` bez Zod/Joi schémat. Funkčně to funguje, ale nemá centrální validaci ani limit délky textů.
- **Strukturované logování:** jen `console.error` v error handleru. Pro produkci pino/winston.

## Další kroky (návrh)

- CI workflow, který spustí `node test.js` na PR.
- Rate-limit na `/api/auth/*`.
- Integrační test pro admin CRUD (kategorie, položky).
- Stripe billing (schéma má prázdný `stripe_customer_id`).

## PR

PR #4: <https://github.com/RubbySource/qr-jidelnicek/pull/4>
