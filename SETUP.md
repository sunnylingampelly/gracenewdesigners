# Grace New Designers — Setup Guide

## Prerequisites
- PHP 8.2+, Composer 2
- Node.js 20+
- MySQL 8+

---

## Backend (Laravel)

```bash
cd backend

# 1. Install dependencies
composer install

# 2. Copy env and edit
cp .env.example .env
# Set DB_DATABASE, DB_USERNAME, DB_PASSWORD, WHATSAPP_NUMBER

# 3. Generate app key
php artisan key:generate

# 4. Create database
mysql -u root -p -e "CREATE DATABASE grace_new_designers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 5. Run migrations + seed
php artisan migrate --seed

# 6. Create storage symlink (for product images)
php artisan storage:link

# 7. Start server
php artisan serve
# → http://localhost:8000
```

**Default admin credentials after seeding:**
- Email: `admin@gracenewdesigners.com`
- Password: `changeme123`

---

## Frontend (React + Vite)

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Copy env
cp .env.example .env
# Set VITE_WA_NUMBER to your actual WhatsApp number (e.g. 919876543210)

# 3. Start dev server
npm run dev
# → http://localhost:5173

# 4. Build for production
npm run build
```

The Vite dev server proxies `/api/*` to `http://localhost:8000`.

---

## Environment variables

### backend/.env (key values)
| Variable | Example |
|---|---|
| `DB_DATABASE` | `grace_new_designers` |
| `DB_USERNAME` | `root` |
| `DB_PASSWORD` | `secret` |
| `WHATSAPP_NUMBER` | `919876543210` |
| `SANCTUM_STATEFUL_DOMAINS` | `localhost:5173` |

### frontend/.env
| Variable | Example |
|---|---|
| `VITE_WA_NUMBER` | `919876543210` |
| `VITE_API_BASE_URL` | *(leave blank — proxy handles it)* |

---

## Roles seeded

| Role | Key permissions |
|---|---|
| super_admin | everything (`*`) |
| manager | sales, CRM, reports, purchasing |
| sales_staff | sales, CRM |
| tailor | view inventory |
| inventory_staff | inventory management |
| accountant | payments, reports |
| receptionist | CRM, view sales |

---

## Production deployment

1. Set `APP_ENV=production`, `APP_DEBUG=false`
2. Run `php artisan config:cache && php artisan route:cache`
3. Serve with Nginx + PHP-FPM; point document root to `backend/public`
4. Run `npm run build` in `frontend/`; serve the `dist/` folder from same or separate domain
5. Update `SANCTUM_STATEFUL_DOMAINS` and `SESSION_DOMAIN` to match your production domain
