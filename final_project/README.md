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
   - `owner1@test.com` / `test1234`: has the **Friend** tracker (the AI pendant and its fall 2025 NYC subway ads), seeded from one real weekly fetch run (Sep 1 – Nov 23, 2025) plus one example chat showing weekly tables, cited sources and charts, and a **Slay the Spire 2** tracker with its own runs and chats. Both are saved in `db/fixtures/subjects/`. Starting the app spends no tokens.
   - `owner2@test.com` / `test1234`: empty account.

Database scripts (stop the dev server first, since it holds the DB open):
- `npm run db:reset`: delete the database. It is recreated and reseeded on the next start.
- `npm run db:seed`: delete, recreate, and reseed it right away.

After pulling, run `npm run db:reset`: the new `prompts.criteria` migration (structured search criteria) needs a fresh database, and the seed data reloads on the next start.

Seed data scripts (no tokens spent):
- `npm run fixture:list`: saved seed subjects and the subjects in your local database.
- `npm run fixture:save -- <subjectId>`: save a subject you fetched (runs, mentions, costs, chats) to `db/fixtures/subjects/`, so it comes back after a reset.
- `npm run fixture:remove -- <slug>`: delete a saved subject's file and remove it from the local database.

Other scripts: `npm run typecheck` and `npm run build`.

Theming: every color (the Graphite and lime palette, light and dark, plus a `chart` group of sentiment fills for charts), font, and size comes from `config/brand.ts`. Edit it there and the page hot-reloads.

## Agents

The UI calls a subject a **tracker**; code, routes and the database keep `subject`.

- **Fetch Agent**: web-searches for mentions of a tracker, one search per daily/weekly/monthly window, optionally steered by **search criteria** (sources, topics, excluded keywords, region, language, notes). Dates already fetched with the same search criteria are skipped, so a request only fetches the gaps (all covered: nothing starts). Fetches start from cards in the chat: **Set up your first fetch** (`FetchSetupCard`) in a new tracker's chat (no LLM call), a saved search criteria clicked in the chat's side panel, or a fetch plan card from the analyst.
- **Analyst Agent**: chats per tracker, with tools `getMentions`, `getSentimentSummary`, `getThemes`, `getTopSources`, `createVisualization`, `listFetchRuns`, `planFetchRun`, `listPrompts`, `createPrompt`, `updatePrompt`, `deletePrompt`. `planFetchRun` takes dates, cadence, saved (`promptId`) or one-time (`criteria`) search criteria, and an optional `followUpQuestion`. Asked about dates that were never fetched, the analyst draws no chart: it shows a pre-filled fetch card (with Edit) whose follow-up question is asked once the fetch finishes. The LLM never starts a fetch or updates/deletes a prompt: it shows a card (`FetchPlanCard`, `PromptUpdateCard`, `PromptDeleteCard`), and the owner's click on **Start fetch**, **Save changes** or **Delete** does. A started fetch plan card records its runs on its chat message (`PATCH /api/chat-sessions/:id/fetch-plan`) so a reload shows them.

Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
