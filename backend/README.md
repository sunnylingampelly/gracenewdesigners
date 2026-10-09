# Grace New Designers — API (Laravel)

Laravel 13 REST API (`/api/v1`) for the catalogue, WhatsApp enquiries, manual orders, CMS and administration.
See the [project README](../README.md), [architecture](../docs/architecture.md), [ERD](../docs/erd.md) and
[OpenAPI spec](../docs/api/openapi.yaml).

```bash
composer install && cp .env.example .env && php artisan key:generate
php artisan migrate --seed && php artisan storage:link
php artisan test
```
