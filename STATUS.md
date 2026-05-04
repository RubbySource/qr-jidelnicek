# STATUS — QR Jidelnicek Pro

_Last updated: 2026-05-04 (větev `claude/hungry-curran-952767`)_

## Noční dávka — co se v této větvi přidalo

### 1. Dietary značky + alergeny + ukázkové menu + bezpečnost (`f14e6e3`)
README slibovala fíčury, které v kódu nebyly:
- DB sloupce: `is_vegetarian`, `is_vegan`, `is_gluten_free`,
  `is_lactose_free`, `is_spicy`, `is_featured`, `allergens` (JSON, kódy 1–14 dle EU 1169/2011)
- Admin UI: stravovací checkboxy, alergenní chipy, badge zobrazení v seznamu
- Public route vrací nové fieldy → PublicMenu už nerenderuje prázdno
- `POST /api/admin/seed-demo` — 5 kategorií / 14 položek s CZ+EN
- `POST /api/admin/{categories,items}/:id/move`

Bezpečnostní vrstva:
- Rate-limiting `/api/auth/login` (10/15min) a `/register` (5/h), in-memory sliding window
- CORS allowlist přes `CORS_ORIGINS` env var
- Validace registrace: email regex, heslo ≥6, jméno 1–120
- `app.set('trust proxy', 1)` — req.ip funguje za Railway proxy

Bugfixy:
- `db.js` měl oříznutý export `module.exports.toN` → `toNum` nikdy neexportoval
- `trial_expires_at` se nikdy nenastavovalo → trial-expiring email se nikdy neposlal
- `SlugEditor` měl hardcoded loca.lt URL
- Cena 199 → 299 Kč napříč (matchne landing + Stripe commit)

### 2. Profil restaurace (`e13e27f`)
- DB: `logo_url`, `phone`, `address`, `opening_hours`, `website_url`
- `PUT /api/admin/profile` (vrací aktualizovaný record)
- Settings tab: nový `ProfileEditor` s logo uploadem (resize 512px)
- PublicMenu hlavička zobrazuje logo + kontaktní údaje + otevírací dobu

### 3. Print stylesheet + health endpoint (`923dff6`)
- `@media print` produkuje čistý A4 jídelní lístek z `/menu/:slug`
- `/api/health` vrací 503 pokud SQLite SELECT 1 selže (Railway healthcheck)

### 4. Password reset (`13cfaa8`)
- Tabulka `password_resets` (token_hash SHA-256, expires_at, used_at)
- `POST /api/auth/forgot` — anti-enumeration (vždy 200), fake bcrypt pro timing
- `POST /api/auth/reset` — token expirace 1h, single-use
- Email template `password-reset.html`
- AuthForm má 4 módy: login/register/forgot/reset

### 5. Menu export/import (`673e769`)
- `GET /api/admin/menu/export` — JSON dump (schema_version: 1)
- `POST /api/admin/menu/import` — `{ replace?: bool }`
- Image URLs (data:) se v exportu schválně přeskočí (bloat)
- Tlačítka v admin Menu tabu

### 6. Duplikace + bulk dostupnost (`91c45a5`)
- `POST /api/admin/items/:id/duplicate` — kopíruje vč. flagů, resetuje is_featured
- `PATCH /api/admin/categories/:id/availability` — bulk toggle všech položek

## Testovací pokrytí (backend/test.js)

Pokrývá: health, register/login, public menu, QR (PNG/SVG/PDF),
seed-demo, dietary flags + allergen 1–14 validaci, move, duplicate,
bulk availability, export/import roundtrip + bad-schema reject,
forgot anti-enum, reset bogus token, profile + propagace na public.

Pozn: lokálně v této worktree není node v PATH, takže testy běží v CI/Railway,
ne tady. Validováno přes pečlivé manual review.

## Otevřené P1 (z předchozího auditu, většina vyřešena výše)

- ✅ **CORS allowlist** — vyřešeno přes `CORS_ORIGINS`
- ✅ **Rate-limiting** — `/login`, `/register`, `/forgot`
- ⏳ **DB backup** — strategie zálohy SQLite (cron + S3 / off-site) stále nedefinovaná
- ⏳ **Validace vstupů** — částečně (auth + slug + profile), zbytek přijde s Zod
- ⏳ **Strukturované logování** — stále jen `console.error`
- ⏳ **CSRF** — ne (JWT v Authorization header to z větší části zachycuje, ale stojí za zvážení)

## Předchozí stav main (kontext)

- backend stabilizace (PR #4)
- admin dashboard (CRUD, drag-drop, base64 upload, availability toggle)
- stripe billing + analytics + email templates
- QR kód barevný PNG/SVG/PDF
