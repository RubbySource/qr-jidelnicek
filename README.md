# QR Jídelníček Pro

Digitální menu pro české restaurace s QR kódem. SaaS, 199 Kč/měsíc.

## Stack
- Backend: Node.js + Express + SQLite (vestavěný `node:sqlite`, vyžaduje Node 22.5+)
- Frontend: React + Vite
- Auth: JWT (bcrypt pro hesla)
- QR: `qrcode` npm balíček

## Funkce
- Veřejné mobilní menu dostupné přes QR kód
- Admin rozhraní pro správu kategorií a položek
- **Stravovací značky** — vegetariánské, vegan, bez lepku, bez laktózy, pikantní
- **Alergeny** dle EU nařízení 1169/2011 (kódy 1–14)
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
- `allergens` — pole kódů alergenů (`["1", "3", "7"]`) podle EU 1169/2011

## Cesty ve frontendu
- `/` — landing
- `/admin` — login + dashboard
- `/menu/:slug` — veřejné menu (mobile-first, CS/EN, vyhledávání, filtry)
