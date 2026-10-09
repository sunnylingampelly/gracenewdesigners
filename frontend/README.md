# Grace New Designers — storefront & admin (Next.js)

Next.js 16 App Router application serving the public storefront and the protected `/admin` interface.
Laravel (`../backend`) is the authoritative API. See the [project README](../README.md) and [docs](../docs).

```bash
cp .env.example .env.local   # API_INTERNAL_URL=http://127.0.0.1:8010
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm run test   # static checks + unit tests
npm run test:e2e             # Playwright journeys (needs the API running with seeded data)
```
