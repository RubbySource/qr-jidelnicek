# STATUS — QR Jidelnicek Pro

_Last updated: 2026-05-01 (merge všech claude/* větví do main)_

## Stav main

Všechny aktivní feature branche sloučeny do `main` a pushnuty na origin.

```
cb7eeab merge: stripe billing + analytics + email templates
7f8467a feat: stripe billing + analytics + email templates
cd9c2cf merge: admin-dashboard (CRUD, drag-drop, base64 upload, availability toggle)
863a846 Merge pull request #4 from RubbySource/claude/backend-stabilizace
3a74f2c merge: resolve STATUS.md conflict (keep backend stabilizace + retain P1 audit notes)
3af23cf feat: admin dashboard - CRUD, drag-drop, image upload, availability, preview
ea455a5 docs: doplnit URL pro ruční vytvoření PR do STATUS.md
2bb46a9 feat: backend smoke tests + stabilizace
```

## Co je v main

- **Backend stabilizace** (PR #4) — `node:sqlite`, `bcryptjs`, 18/18 smoke testů (`backend/test.js`).
- **Admin dashboard** — CRUD pro kategorie/položky, drag-drop řazení, upload obrázků (base64), toggle dostupnosti, preview.
- **Stripe billing + analytics + email templates** — feature-set sloučen na vrchol main.

## Merge poznámky

- `claude/backend-stabilizace` — již součást `main` před touto operací (fast-forward na pull).
- `claude/admin-dashboard` — konflikty v `backend/src/db.js`, `adminRoutes.js`, `publicRoutes.js`, `frontend/src/pages/Admin.jsx`, `frontend/src/styles.css`. Vyřešeno přijetím verze z `admin-dashboard` (`git checkout --theirs`), protože tato větev byla vystavěna nad backend-stabilizací a obsahuje nejnovější admin funkcionalitu.
- `claude/stripe…` jako samostatná větev neexistovala — stripe commity (`7f8467a`, `cb7eeab`) byly už na origin/main při pull.
- Syntax check (`node --check`) prošel pro `backend/src/server.js`, `db.js`, `menu.js`, `routes/adminRoutes.js`, `routes/publicRoutes.js`.

## Push

`git push origin main` ✅ — origin/main = local main (`cb7eeab`).

## Otevřené P1 (z předchozího auditu, stále platné)

- **CORS allowlist:** `app.use(cors())` povoluje všechny originy.
- **Rate-limiting:** `/api/auth/login` a `/api/auth/register` nejsou omezené.
- **DB backup:** strategie zálohy SQLite (cron + S3 / off-site) není definována.
- **Validace vstupů:** chybí Zod/Joi schémata.
- **Strukturované logování:** zatím jen `console.error`.

## PR

PR #4: <https://github.com/RubbySource/qr-jidelnicek/pull/4>
