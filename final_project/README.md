# Perspectives

Track what people say about a business, brand, or handle. See [`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Local dev

Requires Node 20+.

1. Copy `.env.example` to `.env` and fill in:
   - `PORTKEY_API_KEY`: your Portkey key.
   - `SESSION_SECRET`: any long random string (signs the login cookie), e.g. `openssl rand -hex 32`.
   - `DATABASE_PATH` (optional): SQLite file, default `data/perspectives.db`.
2. Install, check the LLM connection, and start the dev server:

   ```bash
   npm install
   npm run check:env   # expect: ✓ gpt-6-luna replied "pong" (...)
   npm run dev         # http://localhost:3000
   ```

   On first start the database is created and seeded automatically.
3. Log in with a test account:
   - `owner1@test.com` / `test1234`: has the **Acme Coffee** subject with sample mentions and a finished fetch run.
   - `owner2@test.com` / `test1234`: empty account.

Database scripts (stop the dev server first, since it holds the DB open):
- `npm run db:reset`: delete the database. It is recreated and reseeded on the next start.
- `npm run db:seed`: delete, recreate, and reseed it right away.

Other scripts: `npm run typecheck`, `npm run build`.

Theming: every color, font, and size comes from `config/brand.ts`. Edit it there and the page hot-reloads.
