# Architecture & implementation decisions

Grace New Designers is a **modular monolith**: one Laravel application is the single source of truth for data and
business rules; one Next.js application renders the public storefront and the `/admin` interface. There are no
microservices — integrations (search engine, payments, WhatsApp Business Platform, currency) slot in behind
interfaces when they are needed.

```
Browser ──► Next.js (storefront + /admin)
              │  server components ──► Laravel API (API_INTERNAL_URL, cached with ISR tags)
              │  /backend/*, /sanctum/* rewrites ──► Laravel (same-origin cookies for admin)
              │  proxy.ts ──► /path-status (301 redirects, 410 gone)
              ▼
           Laravel 13  ──► MySQL 8 (data) · Redis (cache/queue) · S3-compatible storage (media)
              │ queue: image renditions, CSV imports, notifications
              │ scheduler: scheduled publishing, follow-up digest, privacy purge, analytics pruning
              └─► POST {storefront}/api/revalidate after admin changes
```

## Versions chosen

| Component | Version | Why |
|---|---|---|
| PHP | 8.3 | Installed runtime; Laravel 13 requires ≥ 8.3 |
| Laravel | 13.x | Latest stable compatible with PHP 8.3 |
| Next.js | 16.4 (App Router, Turbopack) | Latest stable; React 19.3 |
| MySQL | 8.x | Required; FULLTEXT search, JSON columns, utf8mb4 |
| Tailwind CSS | 4 | CSS-first design tokens via `@theme` |

## Backend layout (`backend/app`)

| Folder | Responsibility |
|---|---|
| `Enums/` | Typed statuses: product status, price mode, stock policy, availability, enquiry/order/payment status, section types |
| `Models/` | Eloquent models; no business logic beyond scopes and small helpers |
| `Services/Catalog` | `ProductService` (create/update/duplicate/publish, variant matrix sync, denormalised listing fields, slug redirects), `ProductListingService` (filters, facets, sorting, pagination), `CategoryService` (tree paths, cycle protection, safe deletes), `ProductCsvService` (idempotent import/export) |
| `Services/Search` | `SearchEngine` interface + `DatabaseSearchEngine` (MySQL FULLTEXT, typo correction) — swap for Meilisearch in `AppServiceProvider` |
| `Services/Enquiries` | `EnquiryService` (server-side validation of products/variants/stock/price, snapshots, references), `WhatsAppMessageBuilder` (message + wa.me URL, long-bag truncation) |
| `Services/Orders` | `OrderService` (manual orders, stock commit/release, status & payment history) |
| `Services/Content` | Homepage draft/publish workflow, typed section schemas, hydration, navigation resolution |
| `Services/Media` | Upload validation (MIME sniffing, size, dimensions), de-duplication, usage tracking |
| `Services/Settings` | Typed admin settings with validation rules and public/private split |
| `Http/Controllers/Api/V1/{Storefront,Admin}` | Thin controllers; Form Requests + Policies; API Resources for serialisation |
| `Policies/`, `Http/Middleware/EnsurePermission` | Server-side authorisation for every admin route |
| `Jobs/`, `Console/Commands/` | Queued work and scheduled tasks |

### Key decisions

- **Variants are rows, not JSON.** `product_variants` holds one row per real size × colour combination with its own SKU,
  stock, policy, optional price and image. A unique `(product_id, combination_key)` prevents duplicates even when an option
  is NULL. The storefront never infers availability for combinations that do not exist.
- **Denormalised listing fields.** `products.min_price`, `has_stock` and `search_text` are recomputed by `ProductService`
  whenever a product or its variants change, so listing filters and sorts stay index-friendly.
- **Categories use a materialised path** (`men/suits/formal`) that is unique, scopes slugs to their parent and is the
  public URL. Renames and moves rebuild descendant paths and record 301 redirects.
- **Price on request is enforced server-side.** `Product::publicPrice()` returns null; public resources, WhatsApp messages
  and structured data never contain a figure for such products.
- **Public/admin resources are separate classes**, so internal fields (`cost_price`, `internal_notes`, exact stock) can never
  leak through the public API (covered by tests).
- **Enquiry references** (`GND-ENQ-000123`, `GND-ORD-000045`) derive from the row id inside the creating transaction.
- **Homepage CMS stores typed JSON** validated per section type (`SectionSchema`) — no arbitrary HTML. Draft and published
  state live side by side so publishing is atomic; editors can preview drafts with short-lived signed tokens.
- **Rich text** (product descriptions, pages) is sanitised with HTMLPurifier to an editorial subset.
- **Stock is committed only when staff confirm an order**, never by an enquiry; cancelling releases it.
- **Timestamps are stored in UTC**; operational schedules and admin displays use `Asia/Kolkata`.

## Frontend layout (`frontend/src`)

| Path | Responsibility |
|---|---|
| `app/(store)/…` | Storefront routes: `/`, `/shop/[...path]`, `/products/[slug]`, `/collections`, `/occasions`, `/lookbook`, `/search`, `/bag`, `/wishlist`, `/pages/[slug]`, `/contact`, `/book-consultation`, `/enquiry/[token]`, `/gone` |
| `app/admin/…` | Client-rendered admin (login, password reset, 2FA, and all modules under `(panel)`) |
| `app/api/{preview,revalidate}` | Draft-mode preview entry/exit; on-demand ISR revalidation |
| `proxy.ts` | 301 redirects and HTTP 410 for removed products |
| `lib/api-server.ts` | Server-side API client with ISR (`next.revalidate`, cache tags) |
| `lib/api-client.ts` | Browser client: same-origin `/backend` rewrite, CSRF cookie, upload progress, CSV download |
| `lib/stores.ts` | Guest bag & wishlist (Zustand + versioned localStorage) |
| `lib/analytics.ts` | Consent-gated events (first-party + optional GA4); no purchase events |
| `components/store`, `components/admin` | Storefront design system; admin UI kit (Radix-based) and module components |

### Rendering & caching

- `cacheComponents` is **off** deliberately: the catalogue comes from a live API, and the fetch-revalidate (ISR) model keeps
  `next build` independent of API availability for dynamic routes. Catalogue fetches revalidate every
  `CATALOG_REVALIDATE_SECONDS` and are tagged `catalog`; the backend calls `/api/revalidate` after admin changes so publishes
  appear immediately.
- Imagery: the backend generates WebP renditions (320–2400px, never upscaled) and the storefront renders them with `srcset`,
  intrinsic width/height (no layout shift) and lazy loading below the fold. The Next image optimiser is not used.
- Faceted URLs (`?size=m&color=navy-blue…`) are crawlable but `noindex, follow`, with canonicals pointing at the clean listing.

### Authentication

The admin uses **Sanctum SPA cookie sessions**. The browser only talks to the storefront origin; `/backend/*` and `/sanctum/*`
are rewritten to Laravel, so cookies are first-party and CSRF protection applies. Optional or role-mandated TOTP 2FA with
recovery codes; login throttling per email+IP; uniform login errors; strong password policy.

## WhatsApp commerce flow

```
PDP / bag ── POST /api/v1/enquiries ──► validate product published, variant exists & enquirable, custom-size allowed
                                         snapshot name/SKU/size/colour/price (never for price-on-request)
                                         create GND-ENQ-xxxxxx, history, analytics event (no PII)
          ◄── { reference, whatsapp_url, message, summary_token }
browser ── sendBeacon /enquiries/{ref}/redirected  ──► redirect_initiated_at
        ── location → https://wa.me/<number>?text=<encoded message>
```

Customer contact details and measurements are optional, require explicit privacy consent, are stored only in the database
(measurements encrypted) and never appear in the WhatsApp URL or analytics. Long bags are truncated to fit WhatsApp URL limits
and link to a shareable `/enquiry/{token}` summary containing catalogue details only.

## Guest list merge strategy (future customer accounts)

Bag and wishlist are stored in versioned localStorage (`gnd-bag`, `gnd-wishlist`, version 1) keyed by product/variant ids.
When accounts are introduced: on sign-in, POST the local lists to a `/me/lists/merge` endpoint that upserts by
`(customer_id, product_id, variant_id)` — taking the larger quantity for duplicates, revalidating each line against live
variants — then clear local storage and read lists from the server thereafter. Bump the store `version` and use Zustand's
`migrate` for shape changes.

## Extension points (not implemented yet, by design)

| Future capability | Where it plugs in |
|---|---|
| Meilisearch/OpenSearch | Implement `App\Services\Search\SearchEngine`, bind in `AppServiceProvider` |
| Online checkout & payments | New `Payments` module creating `orders` (payment_status already modelled); bag already holds variant ids |
| WhatsApp Business Platform API | Listener on enquiry creation; templates; webhooks updating enquiry status |
| Multi-currency | `currency` column on products/enquiries/orders already present; add a rates service and display layer |
| Languages | Content tables are single-language; add translation tables keyed by locale |
| Shipping APIs | `orders.tracking_*` fields + a carrier service |
