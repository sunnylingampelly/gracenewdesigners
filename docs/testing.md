# Testing guide

| Layer | Tool | Location | Command |
|---|---|---|---|
| API feature tests | PHPUnit 12 (SQLite in-memory) | `backend/tests/Feature` | `cd backend && php artisan test` |
| Frontend unit tests | Vitest + Testing Library (jsdom) | `frontend/tests/unit` | `cd frontend && npm run test` |
| End-to-end journeys + accessibility | Playwright + axe-core | `frontend/tests/e2e` | `cd frontend && npm run test:e2e` |
| Static checks | ESLint, TypeScript, Laravel Pint | — | `npm run lint && npm run typecheck`, `./vendor/bin/pint --test` |

## Backend coverage (79 tests)

`AuthenticationTest` (login, uniform errors, throttling, inactive users, TOTP enrolment & recovery codes, role-mandated MFA,
password reset) · `PermissionTest` (role boundaries, owner protection, deactivated users, UI permissions not trusted) ·
`ProductManagementTest` (CRUD, HTML sanitising, slug/SKU uniqueness, duplicate variant combinations, cross-product variant SKUs,
publish requirements, scheduling, archive → 410, slug redirects, duplicate, soft delete/restore, bulk actions) ·
`StorefrontCatalogTest` (draft isolation, no internal fields in public payloads, price-on-request, CTA labels, variant matrix,
descendant category filtering, size/colour/price/availability filters, sorting, pagination & validation, facets, empty
category hiding, typo-tolerant search, safe category deletion, cycle protection) · `EnquiryTest` (saved-before-handoff,
message format & URL encoding, invalid/unavailable/foreign variants, unpublished products, price-on-request messages, custom
size, privacy consent, attribution consent, long bags & summary, missing WhatsApp number, honeypot, notifications, rate
limiting, lead workflow & CSV export) · `OrderTest` (enquiry → order, agreed prices, stock commit/release, insufficient stock,
one order per enquiry, validation) · `MediaUploadTest` (renditions, de-duplication, disguised executables, minimum dimensions,
in-use protection, permissions) · `HomepageBuilderTest` (draft vs live, reorder + publish, preview tokens, typed/sanitised
config, testimonials consent, pending removal) · `ProductImportTest` (dry run without writes, commit, idempotent re-import,
formula-safe export, missing columns) · `DashboardTest` (measured vs confirmed, reports ranges, permissions).

## End-to-end journeys (Playwright)

Prerequisites: a seeded local database and both servers running.

```bash
cd backend && php artisan migrate:fresh --seed
(cd backend/public && php -S 127.0.0.1:8010 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php)
(cd frontend && npm run dev)
cd frontend && npx playwright install chromium && npm run test:e2e
```

| Spec | Journey |
|---|---|
| `journey-a-storefront-to-whatsapp` | **A** Homepage → Category → Product → Variant → WhatsApp handoff (message contents verified; `wa.me` is intercepted) and sold-out combinations refused. Also runs on a Pixel 7 viewport. |
| `journey-b-admin-catalog` | **B** Admin login → add category → add product → upload image → publish → verify the storefront page |
| `journey-c-enquiry-to-order` | **C** Visitor enquiry → admin enquiry list → update lead → create and confirm order → enquiry shows *Order Confirmed* |
| `journey-d-homepage-builder` | **D** Reorder homepage sections with the keyboard → publish → storefront updates → original order restored |
| `accessibility` | axe-core WCAG 2.2 A/AA (serious/critical) on key templates; no horizontal overflow at 360px |

Journeys configure a clearly fictional WhatsApp number (`E2E_WHATSAPP_NUMBER`, default `+911234567890`) and create
uniquely named records, so they can be re-run. Journey D skips itself if the homepage has unpublished drafts, so it never
publishes someone else’s work. Override `E2E_BASE_URL`, `API_INTERNAL_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` for other environments.

## Manual checks before release

- Responsive review at 360, 390, 430, 768, 1024, 1440 and 1920px (storefront and admin on tablet).
- Keyboard-only pass: header mega menu, mobile drawer, search overlay, filters, size/colour radios, gallery, dialogs.
- Screen reader spot-check of the product page and enquiry flow.
- Lighthouse / real-user Core Web Vitals on production hardware (targets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at p75) —
  these are targets requiring field measurement, not guarantees.
