# P1 Audit — QR Jídelníček Pro

**Datum auditu:** 2026-05-01
**Větev:** `claude/cranky-euler-b43383` (rebasováno na `main`)
**Hlava `main` při auditu:** `54b7710 — Merge pull request #1 (allergens, multi-language, Railway deploy)`

---

## TL;DR

MVP je **kompletní a vnitřně konzistentní** — backend i frontend pokrývají všechny endpointy z README, schéma DB sedí s rolemi v rutách, auth/JWT/bcrypt jsou správně. `main` mezitím dostal velké rozšíření (alergeny, vícejazyčnost, řazení, Railway deploy), které tento audit nepokrýval rozsahem — komentáře níže se týkají jádra ze základního MVP.

V této větvi opraveno (delta proti `main`): chybějící produkční API URL ve frontendu (`VITE_API_URL`), chybějící `engines` v `package.json`. Audit zaznamenává otevřené P1 položky, které ani Railway-deploy commit neřeší.

---

## Co funguje (ověřeno čtením kódu MVP)

### Backend (`backend/`)
- **Entrypoint:** `backend/src/server.js`
- **Express server**: CORS, JSON parser (limit 1 MB), error handler
- **DB:** SQLite přes vestavěný `node:sqlite` (žádná native závislost — výborně pro Windows i Railway)
- **Schéma** (`backend/src/db.js`): `restaurants`, `menus`, `categories`, `items` s FK + indexy
- **Endpointy** — všechny z README jsou implementované (health, public menu, QR, auth, admin CRUD)
- **Auth** (`backend/src/auth.js`): JWT s 30denní expirací, `Bearer` header
- **Bezpečnost na úrovni dat:** každá admin operace ověřuje vlastnictví přes `ownsCategory` / `ownsItem` JOIN proti `restaurant_id` z JWT — **správně, žádný IDOR**
- **Slug:** auto-generování s deduplikací (`-2`, `-3`, …)
- **Heslo:** `bcryptjs` cost 10

### Frontend (`frontend/`)
- React 18 + Vite + react-router-dom v6
- Routy: `/`, `/admin`, `/menu/:slug`
- Vite dev proxy `/api` → `localhost:3001`
- Mobile-first CSS, viewport meta, `lang="cs"`
- LocalStorage pro JWT (`qrj_token`)

---

## Opraveno v této větvi (delta proti `main`)

| # | Problém | Oprava | Soubor |
|---|---------|--------|--------|
| 1 | Frontend neměl podporu pro samostatný produkční API host — `api.js` měl natvrdo relativní cesty `/api/...`. Pro deploy, kde frontend běží na jiné doméně než backend, nebylo kam nasměrovat fetch. | Přidána proměnná `VITE_API_URL` přes `import.meta.env`, použita ve fetchích i v `qrUrl(slug, opts)`. Když je prázdná (dev / single-origin Railway deploy), chování zůstává stejné jako dřív. | `frontend/src/api.js`, `frontend/.env.example` (nový) |
| 2 | `package.json` neměl `engines` — `npm install` na Node < 22.5 prošel, ale start backendu pak ihned spadl na `require('node:sqlite')`. | Přidán `engines.node >=22.5.0` do backendu, `>=20.0.0` do frontendu. Teď npm warne (a Railway/Vercel build odmítne) na špatné verzi Node. | `backend/package.json`, `frontend/package.json` |

> Poznámka: během auditu jsem **nemohl spustit `npm install` ani `npm run dev`** — Node.js není v tomto prostředí k dispozici. Všechna zjištění jsou ze statického čtení zdrojových souborů.

---

## Co chybí / Otevřené P1 (ani Railway deploy commit to neřeší)

### Před produkčním ostrým provozem
- **CORS allowlist:** `app.use(cors())` v `backend/src/server.js` povoluje všechny originy. Pro produkci nastavit konkrétní frontend doménu.
- **Rate-limiting:** `/api/auth/login` a `/api/auth/register` nejsou nijak omezené → brute-force riziko. Doporučeno `express-rate-limit` (např. 10 pokusů/min na IP).
- **JWT_SECRET:** Railway env var konfigurace už toto bere v potaz (`openssl rand -hex 32`), ale `.env.example` v `backend/` má stále `change-me-in-production` — zkontrolovat, že žádný onboarding vzor neúmyslně tento řetězec nepoužije v produkci.
- **DB backup:** Railway Volume zachová SQLite mezi redeploys, ale strategie zálohy (cron + S3 / off-site) zatím není definovaná.

### P2 — kvalita kódu, není blocker
- **Žádné testy** — ani backend, ani frontend nemají test runner. Pro placený SaaS doporučuji aspoň smoke test auth + menu CRUD (vitest/supertest).
- **Žádná CI** — žádný `.github/workflows/`. Při prvním PR by se hodil minimálně lint + build + test.
- **Žádný linter / formatter** — ESLint ani Prettier nenastavené.
- **Žádná validace vstupů** — backend přijímá `req.body` bez Zod/Joi schémat. Funkčně to funguje, ale nemá centrální validaci ani limit délky textů (`name`, `description` můžou být libovolně velké do 1 MB body limitu).
- **Žádné strukturované logování** — jen `console.error` v error handleru. Pro produkci pino nebo winston (zvlášť na Railway, kde logy jdou rovnou do agregátoru).

### P3 — produktové mezery
- Žádný password reset / change-password endpoint
- Žádné mazání účtu (GDPR)
- Žádný Stripe billing — README zmiňuje "199 Kč/měsíc", ale `stripe_customer_id` ve schématu je prázdný sloupec

---

## Doporučené další kroky (v pořadí priority)

1. **Před prvním production deployem:** rate-limiting + CORS allowlist + ověřit silný `JWT_SECRET` v Railway env vars.
2. **Smoke test (lokálně, vyžaduje Node 22.5+):** registrace → přidat kategorii → přidat položku s alergenem a tagem → otevřít `/menu/:slug` v incognito → naskenovat QR z `/api/qr/:slug?format=png&size=1024`.
3. Stripe billing nebo otevřená komunikace, že MVP je momentálně zdarma.

---

*Audit provedl Claude Code (Opus 4.7). Žádný kód nebyl spuštěn — všechna zjištění jsou ze čtení zdrojových souborů.*
