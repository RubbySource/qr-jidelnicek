# QR Jídelníček Pro

Digitální menu pro české restaurace s QR kódem. SaaS, 299 Kč/měsíc.

## Stack
- **Backend**: Node.js (≥ 22.5) + Express + vestavěný `node:sqlite`
- **Frontend**: React 18 + Vite (build se servíruje přímo z backendu)
- **Auth**: JWT (`jsonwebtoken`) + `bcryptjs`
- **QR**: `qrcode` npm balíček
- **Billing**: Stripe (Checkout + webhooky) — volitelné
- **E-mail**: Resend + HTML šablony v `backend/emails/` — volitelné

## Funkce
- Veřejné mobilní menu dostupné přes QR kód
- Admin dashboard: CRUD kategorií/položek, drag-drop řazení, base64 upload obrázků, toggle dostupnosti, preview
- **Stravovací značky** — vegetariánské, vegan, bez lepku, bez laktózy, pikantní
- **Alergeny** dle EU 1169/2011 (kódy 1–14)
- **Doporučujeme** — vlastní sekce nahoře v menu
- **Vyhledávání a filtrování** v menu
- **CS / EN** přepínač
- **QR ke stažení** v PNG (1024 px) i SVG
- **Stripe billing** — měsíční předplatné 299 Kč, trial, webhooky pro aktivaci/expiraci
- **Transakční e-maily** — payment-confirmed, trial-expiring (Resend, dry-run režim bez API klíče)
- **Ukázkové menu** — `/api/admin/seed-demo`

## Struktura
```
qr-jidelnicek/
├── backend/        # Express API (port 3001) + servíruje frontend/dist
│   ├── emails/     # HTML šablony pro Resend
│   └── src/
│       ├── server.js
│       ├── db.js
│       ├── auth.js
│       ├── email.js
│       ├── menu.js
│       └── routes/
├── frontend/       # React + Vite (dev port 5173, prod → backend/dist)
├── package.json    # root deploy manifest (Railway / Heroku-style)
├── Procfile
└── railway.json
```

## Spuštění lokálně (single-process — backend servíruje frontend)

```bash
cd backend && npm install
cd ../frontend && npm install && npm run build
cd ../backend && node src/server.js
```

Aplikace pak poběží na `http://localhost:3001` — backend obsluhuje `/api/*` routy a zároveň servíruje statický `frontend/dist/`. React Router fallback (`*` → `index.html`) je už zapojený, takže `/admin` a `/menu/:slug` fungují i po reloadu.

## Spuštění lokálně (dev — split, hot reload)

V jednom terminálu:
```bash
cd backend
cp ../.env.example .env   # uprav podle sebe
npm install
npm run dev               # node --watch src/server.js
```

V druhém terminálu:
```bash
cd frontend
cp .env.example .env      # v devu nech VITE_API_URL prázdné — Vite proxyuje /api → :3001
npm install
npm run dev               # vite, port 5173
```

## Environment proměnné

V kořeni `.env.example`:

| Proměnná | Default | Popis |
|---|---|---|
| `PORT` | `3001` | Port backendu |
| `JWT_SECRET` | `change-me-in-production` | Klíč pro podepisování JWT — v produkci nastav silný náhodný řetězec |
| `DATABASE_URL` | `file:./data/qr-jidelnicek.sqlite` | Cesta k SQLite souboru |
| `PUBLIC_BASE_URL` | `http://localhost:5173` | Použito pro `success_url`/`cancel_url` Stripe Checkoutu a odkazy v e-mailech |
| `STRIPE_SECRET_KEY` | _(volitelné)_ | Bez něj `/api/billing/*` vrací 503 |
| `STRIPE_WEBHOOK_SECRET` | _(volitelné)_ | Bez něj se webhook signature neověřuje (jen JSON parse) |
| `RESEND_API_KEY` | _(volitelné)_ | Bez něj jdou e-maily do dry-run režimu (jen log) |
| `EMAIL_FROM` | `QR Jidelnicek <onboarding@resend.dev>` | Odesílatel transakčních e-mailů |
| `CORS_ORIGINS` | _(prázdné)_ | Comma-separated allowlist origins. V produkci nech prázdné pokud single-process; nastav frontend domény, pokud běží odděleně. `*` povolí vše (jen dev). |
| `NODE_ENV` | `development` | V produkci nastav `production` — vypne fallback "allow all" CORS chování. |
| `DISABLE_RATE_LIMIT` | _(prázdné)_ | Nastav `1` pouze v testech — vypne rate-limiting `/api/auth/*`. |

Frontend čte pouze `VITE_API_URL` (viz `frontend/.env.example`). V devu nech prázdné, v produkci stejné nech, pokud běží jako single-process — všechna API volání jsou relativní (`/api/...`).

## API endpointy

### Veřejné
- `GET  /api/health`
- `GET  /api/menu/:slug` — JSON menu zákazníka (kategorie + položky + alergeny + značky)
- `GET  /api/qr/:slug?size=1024&format=png|svg&download=1` — QR kód

### Auth
- `POST /api/auth/register` — `{ name, email, password, slug? }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/forgot` — `{ email }` — vždy vrací 200 (anti-enumeration). Pošle e-mail s tokenem (1h platnost) přes Resend.
- `POST /api/auth/reset` — `{ token, password }` — vrací nový JWT.

### Admin (Bearer token)
- `GET    /api/admin/me`
- `GET    /api/admin/menu`
- `POST   /api/admin/categories`
- `PUT    /api/admin/categories/:id`
- `PUT    /api/admin/categories/:id/order` — `{ position }` (drag-drop)
- `POST   /api/admin/categories/:id/move` — `{ direction: "up"|"down" }`
- `DELETE /api/admin/categories/:id`
- `POST   /api/admin/items`
- `PUT    /api/admin/items/:id`
- `PUT    /api/admin/items/:id/order` — `{ position }`
- `PATCH  /api/admin/items/:id/availability` — `{ available }`
- `POST   /api/admin/items/:id/move` — `{ direction: "up"|"down" }`
- `DELETE /api/admin/items/:id`
- `POST   /api/admin/seed-demo` — `{ force: bool }`. Bez `force=true` vrací 409 pokud už menu obsahuje kategorie.
- `POST   /api/admin/categories/:id/move` — `{ direction: "up"|"down" }`
- `POST   /api/admin/items/:id/move` — `{ direction: "up"|"down" }`
- `PUT    /api/admin/profile` — `{ name?, logo_url?, phone?, address?, opening_hours?, website_url? }`

### Billing (Stripe)
- `GET  /api/billing/status` — info o předplatném, trial dnech zbývajících
- `POST /api/billing/checkout` — vytvoří Stripe Checkout Session, vrátí `{ url }`
- `POST /api/billing/webhook` — Stripe webhook (raw body, vyžaduje `STRIPE_WEBHOOK_SECRET` pro signature check)

## Datový model položky
- `available` — dostupné / vyprodané (toggle v adminu)
- `is_vegetarian`, `is_vegan`, `is_gluten_free`, `is_lactose_free`, `is_spicy`
- `is_featured` — zobrazí se v sekci "Doporučujeme" nahoře
- `allergens` — pole kódů (`["1", "3", "7"]`)
- `image_base64` — obrázek inline (uploaduje se jako data-URL)

## Cesty ve frontendu
- `/` — landing
- `/admin` — login / dashboard
- `/menu/:slug` — veřejné menu (CS/EN, vyhledávání, filtry)

## Deploy na Railway

Detaily v [`railway.json`](./railway.json) a [`package.json`](./package.json) (root manifest).

### Postup
1. **New Project** → *Deploy from GitHub repo* → vyber `qr-jidelnicek`.
2. **Variables** podle `.env.example`:
   - `JWT_SECRET` — `openssl rand -hex 32`
   - `DATABASE_URL` — např. `file:/app/data/qr-jidelnicek.sqlite`
   - `PUBLIC_BASE_URL` — veřejná URL projektu
   - Stripe / Resend klíče dle potřeby
3. **Volume** — namountuj na `/app/data` (jinak SQLite zmizí při redeployi).
4. **Deploy** — Railway si přečte `railway.json` (NIXPACKS, `npm run build` → `npm run start`).
5. **Stripe webhook** — v Stripe dashboardu nastav endpoint `https://<tvoje-domena>/api/billing/webhook` a `STRIPE_WEBHOOK_SECRET` zkopíruj do Variables.

### Lokální simulace produkčního buildu
```bash
npm install        # spustí postinstall pro backend i frontend
npm run build      # vite build → frontend/dist/
npm run start      # node backend/src/server.js — servíruje API i SPA na :3001
```

## Smoke testy

```bash
cd backend && npm install && node test.js
```
Pokrývá registraci, login, CRUD kategorií/položek, řazení, dostupnost, public menu, QR endpoint.
