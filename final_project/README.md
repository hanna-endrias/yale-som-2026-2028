# Perspectives

Track what people say about a business, brand, or handle. See [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

Current state: scaffold only (one page + a Portkey health check).

## Local dev

Requires Node 20+.

1. Copy `.env.example` to `.env` and add your `PORTKEY_API_KEY`.2. Install and check the LLM connection:

   ```bash
   npm install
   npm run check:env
   ```

   Expected: `✓ gpt-6-luna replied "pong" (...)`.
3. Start the dev server and open http://localhost:3000:

   ```bash
   npm run dev
   ```

   Click **Test Portkey connection** to run the same check from the browser (`GET /api/health/ai`).

Other scripts: `npm run typecheck`, `npm run build`.

Theming: every color, font, and size comes from `config/brand.ts` — edit it there and the page hot-reloads.
