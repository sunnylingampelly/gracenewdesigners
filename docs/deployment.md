# Deployment guide

Reference topology (single VM or two small VMs; any managed equivalents work):

```
                 HTTPS (Let's Encrypt)
Internet ──► nginx ──► Next.js  (node, :3000)   www.example.com   — storefront + /admin
                 └───► PHP-FPM  (Laravel public/) api.example.com — optional public API host
Laravel ──► MySQL 8 · Redis · S3-compatible bucket (+ CDN) · SMTP
Workers: php artisan queue:work (supervisor) · scheduler (cron, every minute)
```

The browser only needs the storefront domain: `/backend/*` and `/sanctum/*` are rewritten by Next.js to Laravel
(`API_INTERNAL_URL`), keeping admin session cookies first-party. Exposing `api.example.com` publicly is optional (media URLs
use the CDN/bucket when `MEDIA_DISK=s3`).

## 1. Prerequisites

- PHP 8.3+ with `pdo_mysql`, `gd` (WebP; AVIF optional), `intl`, `fileinfo`, `mbstring`, `zip`, `redis` (phpredis), `opcache`
- Composer 2, Node.js 20.9+ (24 LTS recommended), MySQL 8.0+, Redis 6+
- An S3-compatible bucket (AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO) with public-read objects or a CDN in front
- SMTP credentials for admin notifications and password resets
- TLS certificates (e.g. certbot)

## 2. MySQL

```sql
CREATE DATABASE grace_new_designers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gnd_app'@'%' IDENTIFIED BY '<strong password>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON grace_new_designers.* TO 'gnd_app'@'%';
```

`sql_mode` must include `STRICT_TRANS_TABLES` (Laravel's default `strict => true`). FULLTEXT search uses InnoDB defaults
(`innodb_ft_min_token_size=3`).

## 3. Backend (Laravel)

```bash
git clone <repo> /var/www/gnd && cd /var/www/gnd/backend
composer install --no-dev --optimize-autoloader
cp .env.example .env && php artisan key:generate
```

Production `.env` essentials (see `backend/.env.example` for every key):

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
FRONTEND_URL=https://www.example.com
DB_CONNECTION=mysql            # + DB_HOST / DB_DATABASE / DB_USERNAME / DB_PASSWORD
CACHE_STORE=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
SESSION_ENCRYPT=true
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=www.example.com
CORS_ALLOWED_ORIGINS=https://www.example.com
TRUSTED_PROXIES=127.0.0.1      # or your load balancer CIDR
MEDIA_DISK=s3                  # + AWS_* (and AWS_URL = CDN base URL)
MAIL_MAILER=smtp               # + MAIL_*
STOREFRONT_REVALIDATE_URL=https://www.example.com/api/revalidate
STOREFRONT_REVALIDATE_SECRET=<long random string, same as frontend REVALIDATE_SECRET>
ADMIN_EMAIL=<owner email>
ADMIN_PASSWORD=<temporary strong password — change after first login>
SEED_DEMO=false
```

```bash
php artisan migrate --force
php artisan db:seed --force          # roles, owner, taxonomy, pages (drafts), menus, homepage with placeholders — no demo products
php artisan storage:link             # only when MEDIA_DISK=public
php artisan config:cache && php artisan route:cache && php artisan event:cache
```

PHP settings: `upload_max_filesize = 30M`, `post_max_size = 35M`, `memory_limit = 512M` (image processing),
`opcache.enable=1`. Sample configs: [`infrastructure/nginx/`](../infrastructure/nginx), [`infrastructure/php/`](../infrastructure/php).

### Queues and scheduler

- Worker (supervisor): [`infrastructure/supervisor/gnd-worker.conf`](../infrastructure/supervisor/gnd-worker.conf) —
  `php artisan queue:work redis --tries=3 --max-time=3600`. Restart workers on every deploy (`php artisan queue:restart`).
- Scheduler (cron): `* * * * * cd /var/www/gnd/backend && php artisan schedule:run >> /dev/null 2>&1`
  ([`infrastructure/cron/gnd`](../infrastructure/cron/gnd)). Jobs: scheduled publishing (every minute), follow-up digest
  (09:00 IST), privacy purge (03:30 IST), analytics pruning (weekly), failed-job pruning.

## 4. Frontend (Next.js)

```bash
cd /var/www/gnd/frontend
npm ci
cp .env.example .env.production
# NEXT_PUBLIC_SITE_URL=https://www.example.com
# API_INTERNAL_URL=http://127.0.0.1:8080   (internal address of the Laravel vhost)
# CATALOG_REVALIDATE_SECONDS=60
# REVALIDATE_SECRET=<same as backend STOREFRONT_REVALIDATE_SECRET>
npm run build
```

Run with systemd ([`infrastructure/systemd/gnd-frontend.service`](../infrastructure/systemd/gnd-frontend.service)) —
`npm run start -- -p 3000` — behind nginx. The build pre-renders some pages and therefore needs the API reachable
at build time; build after the backend is migrated. Static assets under `/_next/static` are immutable and CDN-cacheable.

## 5. HTTPS, headers and CDN

- Terminate TLS at nginx (HTTP → HTTPS redirect, HSTS). Laravel adds `Strict-Transport-Security` on secure requests and
  security headers on every response; Next adds `nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `noindex` + `DENY`
  framing for `/admin`.
- Point a CDN at the media bucket (set `AWS_URL` to the CDN origin).
- Submit `https://www.example.com/sitemap.xml` in Google Search Console; add the verification token in Admin → SEO.

## 6. Backups

- **Database**: nightly `mysqldump --single-transaction --routines --triggers grace_new_designers | gzip` to off-site storage,
  retained 30 days (plus weekly/monthly); test a restore monthly. Point-in-time recovery: enable binlogs or use a managed DB.
- **Media**: enable bucket versioning and cross-region replication (originals are kept; renditions can be regenerated with
  *Reprocess* in the media library).
- **Config**: store `.env` files in a secrets manager — never in git.

## 7. Logging & monitoring

- Laravel: `LOG_STACK=daily` (or ship to your log platform via `stderr`), `LOG_LEVEL=warning` in production.
- Health check: `GET /up` (Laravel). Monitor queue depth and failed jobs (`php artisan queue:failed`).
- Next: process manager logs; alert on 5xx rates at nginx.

## 8. Deploying updates

```bash
cd /var/www/gnd && git pull
cd backend && composer install --no-dev --optimize-autoloader && php artisan down --render="errors::503" \
  && php artisan migrate --force && php artisan optimize && php artisan up && php artisan queue:restart
cd ../frontend && npm ci && npm run build && sudo systemctl restart gnd-frontend
```

Zero-downtime alternative: build into a new release directory, switch a `current` symlink, then reload PHP-FPM and the
Next service.

## 9. Rollback

1. Check out the previous release tag (or switch the `current` symlink back) for both apps.
2. If the failed release ran migrations, roll them back **only if** they are reversible and no new data depends on them:
   `php artisan migrate:rollback --step=<n> --force`. Otherwise restore the pre-deploy database backup taken in step 8.
3. `php artisan optimize && php artisan queue:restart`; rebuild/restart the frontend.
4. Purge CDN/ISR caches: `curl -X POST -H "x-revalidate-secret: …" https://www.example.com/api/revalidate`.

## Launch checklist

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, unique `APP_KEY`, HTTPS everywhere, secure cookies
- [ ] MySQL user least-privilege; automated backups verified by a test restore
- [ ] Redis for cache, sessions and queues; supervisor worker running; cron scheduler installed
- [ ] `MEDIA_DISK=s3` with CDN; PHP upload limits raised; GD with WebP
- [ ] SMTP working (password reset email received)
- [ ] Owner account created with a strong password and **2FA enabled**; demo role accounts absent (only created in `local`)
- [ ] Admin → Settings: WhatsApp number tested, site URL, logos, contact, social links
- [ ] Demo catalogue not seeded (`SEED_DEMO=false`); placeholder images replaced; policies written and published
- [ ] Testimonials only from consenting clients; no invented claims or numbers in content
- [ ] `STOREFRONT_REVALIDATE_SECRET` = `REVALIDATE_SECRET`; publishing a homepage change appears immediately
- [ ] Sitemap and robots reachable; Search Console verified; GA4 ID (optional) set and consent banner working
- [ ] `php artisan test`, `npm run lint`, `npm run typecheck`, `npm run test`, and the Playwright journeys pass on staging
- [ ] Core Web Vitals measured on staging/production (targets LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1)
