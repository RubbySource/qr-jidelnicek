# STATUS — QR Jidelnicek Pro

_Last updated: 2026-05-01 (větev `claude/qr-kod-vylepseni`)_

## Co se přidalo

**QR kód vylepšení — barevný PNG + SVG + PDF download**

### Backend (`backend/src/routes/publicRoutes.js`)
- Nainstalován `pdfkit` (qrcode už byl); přidán import `PDFDocument`.
- Endpoint `GET /api/qr/:slug` rozšířen o query param `?format=png|svg|pdf` (default `png`).
- Společná QR konfigurace: `color { dark: '#1a1a2e', light: '#ffffff' }`, `width: 512`, `margin: 2`, `errorCorrectionLevel: 'H'` — brand barva místo defaultní černé, vysoká chybová korekce kvůli potenciálnímu logu / poškrábání nálepky.
- **PNG** (default) — `QRCode.toBuffer(url, QR_OPTIONS)`, `Cache-Control: public, max-age=300`.
- **SVG** — `QRCode.toString(url, { ...QR_OPTIONS, type: 'svg' })`, `Content-Type: image/svg+xml`.
- **PDF (A4)** — PDFKit dokument: vystředěný název restaurace (Helvetica-Bold 28, brand barva), podtitul, QR kód 300×300 px, URL pod QR jako klikatelný odkaz.
- Společný `?download=1` přepínač pro `Content-Disposition: attachment`.

### Frontend
- Nová stránka `frontend/src/pages/QRPage.jsx`:
  - Preview QR kódu (img tag s `/api/qr/:slug`).
  - Tři tlačítka — **Stáhnout PNG / SVG / PDF (A4)** — fetch + Blob + `<a download>` trigger.
  - Loading state per format, error display, tipy pro tisk.
- Route `/qr/:slug` přidána do `frontend/src/main.jsx`.
- Admin dashboard (`frontend/src/pages/Admin.jsx`) má nové tlačítko **📥 QR kód** vedle "Zobrazit jako zákazník" + textový odkaz "Stáhnout v PNG / SVG / PDF →".

## Build & syntax check

- `npm install` v `backend/` (přidán pdfkit ^0.18.0) i `frontend/` ✅
- `npm run build` (vite): `dist/assets/index-Bq1pT-4F.js 186.53 kB │ gzip: 60.74 kB` ✅
- `node --check` na `publicRoutes.js` a `server.js` ✅

## Push

Větev `claude/qr-kod-vylepseni` pushnuta na origin (viz commit níže).

## Předchozí stav main (kontext)

- backend stabilizace (PR #4)
- admin dashboard (CRUD, drag-drop, base64 upload, availability toggle)
- stripe billing + analytics + email templates

## Otevřené P1 (z předchozího auditu, stále platné)

- **CORS allowlist:** `app.use(cors())` povoluje všechny originy.
- **Rate-limiting:** `/api/auth/login` a `/api/auth/register` nejsou omezené.
- **DB backup:** strategie zálohy SQLite (cron + S3 / off-site) není definována.
- **Validace vstupů:** chybí Zod/Joi schémata.
- **Strukturované logování:** zatím jen `console.error`.
