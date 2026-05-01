# QR Jídelníček Pro

Digitální menu pro české restaurace s QR kódem. SaaS, 199 Kč/měsíc.

## Stack
- Backend: Node.js + Express + SQLite (vestavěný `node:sqlite`, vyžaduje Node 22.5+)
- Frontend: React + Vite
- Auth: JWT (bcryptjs pro hesla)
- QR: `qrcode` npm balíček

## Funkce
- Veřejné mobilní menu dostupné přes QR kód
- Admin rozhraní pro správu kategorií a položek
- **Stravovací značky** — vegetariánské, vegan, bez lepku, bez laktózy, pikantní
- **Alergeny** dle EU nařízení 1169/2011 (kódy 1–14)
- **Doporučujeme** — položky označené jako doporučené se zobrazí ve vlastní sekci nahoře na veřejném menu
- **Vyhledávání a filtrování** položek na veřejném menu
- **Vícejazyčné UI** — čeština / angličtina (přepínač přímo v menu)
- **Změna pořadí** kategorií i položek
- **Stažení QR kódu** v PNG (1024 px) i SVG (vektor pro tisk)
- **Ukázkové menu** — jedním klikem naplníte vzorová data k vyzkoušení
- Mobile-first design

## Struktura
```
qr-jidelnicek/
├── backend/    # API server (port 3001)
└── frontend/   # React app (port 5173)
```

## Spuštění (dev)

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env   # produkční build → nastavit VITE_API_URL
npm install
npm run dev
```

## API endpointy

### Veřejné
- `GET  /api/health`
- `GET  /api/menu/:slug` — JSON menu pro zákazníka (včetně alergenů a stravovacích značek)
- `GET  /api/qr/:slug?size=1024&format=png|svg&download=1` — QR kód v PNG/SVG, volitelně s `Content-Disposition` pro stažení

### Auth
- `POST /api/auth/register` — `{ name, email, password, slug? }`
- `POST /api/auth/login` — `{ email, password }`

### Admin (Bearer token v hlavičce)
- `GET    /api/admin/me`
- `GET    /api/admin/menu`
- `POST   /api/admin/categories`
- `PUT    /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `POST   /api/admin/categories/:id/move` — `{ direction: "up"|"down" }`
- `POST   /api/admin/items`
- `PUT    /api/admin/items/:id`
- `DELETE /api/admin/items/:id`
- `POST   /api/admin/items/:id/move` — `{ direction: "up"|"down" }`
- `POST   /api/admin/seed-demo` — naplní prázdné menu ukázkovými daty

## Datový model položky

Každé jídlo má kromě názvu, ceny a popisu i:
- `available` — dostupné / vyprodané
- `is_vegetarian`, `is_vegan`, `is_gluten_free`, `is_lactose_free`, `is_spicy` — booleany
- `is_featured` — boolean; položka se zobrazí v sekci "Doporučujeme" nahoře
- `allergens` — pole kódů alergenů (`["1", "3", "7"]`) podle EU 1169/2011

## Cesty ve frontendu
- `/` — landing
- `/admin` — login + dashboard
- `/menu/:slug` — veřejné menu (mobile-first, CS/EN, vyhledávání, filtry)

## Deploy na Railway

### Předpoklady
- Účet na [Railway](https://railway.app)
- Repo napojené na GitHub (Railway umí auto-deploy z `main`)

### Konfigurace v repu
- `railway.json` — Nixpacks builder, `npm run build` + `npm run start`
- `Procfile` — `web: node backend/server.js` (kompatibilita s Heroku-style platformami)
- `package.json` v rootu — `build` instaluje deps v `backend/` a `frontend/` a buildne frontend; `start` spouští backend
- `.env.example` v rootu — šablona pro Railway env vars

### Postup
1. **Vytvoř projekt** v Railway → *New Project* → *Deploy from GitHub repo* → vyber `qr-jidelnicek`.
2. **Nastav environment variables** v záložce *Variables* podle `.env.example`:
   - `PORT` — Railway si typicky injektuje vlastní `PORT`, není třeba přepisovat
   - `JWT_SECRET` — vygeneruj silný náhodný řetězec (např. `openssl rand -hex 32`)
   - `DATABASE_URL` — cesta k SQLite souboru, např. `file:./data/qr-jidelnicek.sqlite`
3. **Persistent storage** — pro SQLite přidej v Railway *Volume* a namountuj ho na `/app/data`, jinak se DB ztratí při redeployi.
4. **Deploy** — Railway automaticky detekuje `railway.json`, spustí build a nasadí službu. Veřejnou URL najdeš v záložce *Settings → Networking → Generate Domain*.
5. **Custom doména** (volitelné) — *Settings → Networking → Custom Domain*, přidej CNAME na poskytnutou Railway URL.

### Lokální simulace produkčního buildu
```bash
npm install
npm run build
npm run start
```
