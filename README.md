# QR Jídelníček Pro

Digitální menu pro české restaurace s QR kódem. SaaS, 199 Kč/měsíc.

## Stack
- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: React + Vite
- Auth: JWT (bcrypt pro hesla)
- QR: `qrcode` npm balíček

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
- `GET  /api/menu/:slug` — JSON menu pro zákazníka
- `GET  /api/qr/:slug` — PNG s QR kódem směřujícím na `/menu/:slug`

### Auth
- `POST /api/auth/register` — `{ name, email, password, slug? }`
- `POST /api/auth/login` — `{ email, password }`

### Admin (Bearer token v hlavičce)
- `GET    /api/admin/me`
- `GET    /api/admin/menu`
- `POST   /api/admin/categories`
- `PUT    /api/admin/categories/:id`
- `DELETE /api/admin/categories/:id`
- `POST   /api/admin/items`
- `PUT    /api/admin/items/:id`
- `DELETE /api/admin/items/:id`

## Cesty ve frontendu
- `/` — landing
- `/admin` — login + dashboard
- `/menu/:slug` — veřejné menu (mobile-first)
