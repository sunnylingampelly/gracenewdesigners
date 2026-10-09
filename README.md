# Grace New Designers

A luxury designer-fashion platform for **Grace New Designers** — modern Indian couture, bridal and occasionwear —
with an editorial storefront, a full administration panel and **WhatsApp-assisted buying** (no online card checkout).

| Part | Stack | Folder |
|---|---|---|
| API & business logic | Laravel 13 · PHP 8.3 · MySQL 8 · Sanctum · queues | [`backend/`](backend) |
| Storefront + `/admin` | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · TanStack Query | [`frontend/`](frontend) |
| Documentation | Architecture, ERD, OpenAPI, guides | [`docs/`](docs) |
| Server configuration | nginx, queue worker, scheduler, Node service examples | [`infrastructure/`](infrastructure) |

## How buying works

1. Visitors browse the catalogue, choose a **real size/colour variant** (or *Custom Size*) and quantity.
2. **Order / Enquire / Request Price on WhatsApp** saves an *enquiry intent* (validated server-side against live stock and price),
   then opens `wa.me` with a standardised message and an enquiry reference (e.g. `GND-ENQ-000123`).
3. The team manages the lead in **Admin → Enquiries**, then records a **manually confirmed order**; confirming commits stock.

A WhatsApp redirect is never treated as a sent message, payment or order — the admin always says *“enquiry initiated”*.

## Quick start (local, no Docker)

Requirements: PHP 8.3+ (extensions: pdo_mysql or pdo_sqlite, gd, intl, fileinfo, mbstring, zip), Composer 2, Node 20.9+ (24 recommended).
MySQL 8 and Redis are recommended but optional locally — SQLite and the database queue work out of the box.

```bash
# 1. API
cd backend
composer install
cp .env.example .env              # local: set DB_CONNECTION=sqlite and QUEUE_CONNECTION=sync for the simplest setup
php artisan key:generate
touch database/database.sqlite    # only when using SQLite
php artisan migrate --seed        # roles, taxonomy, pages, menus, homepage + fictional demo catalogue (local only)
php artisan storage:link
cd public && php -d upload_max_filesize=30M -d post_max_size=35M -S 127.0.0.1:8010 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php

# 2. Storefront + admin (new terminal)
cd frontend
npm install
cp .env.example .env.local        # API_INTERNAL_URL=http://127.0.0.1:8010
npm run dev                       # http://localhost:3000  ·  admin at http://localhost:3000/admin
```

The local seeder prints the owner login (`owner@example.com` / `Grace-Local-Dev-2026!`) — change it after first sign-in.
Demo role accounts (`catalog-manager@example.com`, `enquiry-manager@example.com`, `content-editor@example.com`) use the same password locally.

When `QUEUE_CONNECTION` is not `sync`, run `php artisan queue:work` (image renditions, imports, mail) and `php artisan schedule:work`.

### Before launch — configure in Admin → Settings

Nothing about the real business is invented. Set: **WhatsApp business number** (international format), **site URL**,
**logos** (primary / dark / light / mobile / favicon / social image), contact details, address, social links, and review the
seeded *Our Story* and *Privacy Policy* copy. Shipping, returns and terms pages are seeded as **unpublished drafts**.
Replace every image in Media Library → folder `placeholders`, and delete the fictional demo products (tagged **Sample**).

## Tests

```bash
cd backend  && php artisan test                 # 79 feature tests (SQLite in-memory)
cd frontend && npm run test                     # Vitest unit tests
cd frontend && npm run test:e2e                 # Playwright journeys A–D + accessibility (needs both servers running)
cd frontend && npm run lint && npm run typecheck
```

See [docs/testing.md](docs/testing.md).

## Documentation

- [Architecture & implementation decisions](docs/architecture.md)
- [Database ERD](docs/erd.md)
- [API reference (OpenAPI 3.1)](docs/api/openapi.yaml)
- [Admin guide](docs/admin-guide.md)
- [Testing guide](docs/testing.md)
- [Deployment guide & checklist](docs/deployment.md)
