# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Perspectives** is a Next.js 16 / React 19 app (MGT 409 final project) that tracks what people say about a business, brand, or handle: a Fetch Agent web-searches for mentions per date window, and an Analyst Agent answers chat questions over the stored mentions with cited links and sandboxed charts. `docs/PRODUCT.md` covers the why; `docs/ARCHITECTURE.md` is the detailed spec (data model, API table, wireframes, component map) and should be kept in sync with code changes.

This directory lives inside the larger `AI_HW` git repo; run all commands from `final_project/`.

## Commands

```bash
npm run dev          # http://localhost:3000 (DB auto-created, migrated, seeded on first start)
npm run typecheck    # tsc --noEmit — the only static check; there is no linter and no test suite
npm run build
npm run check:env    # one ping to the configured LLM; expect "✓ gpt-6-luna replied "pong""
npm run db:generate  # after editing db/schema.ts → writes a new SQL file to db/migrations/
npm run db:reset     # delete the SQLite DB (recreated + reseeded on next start)
npm run db:seed      # reset and reseed now, prints row counts
npm run fixture:list                 # saved seed subjects vs. live DB subjects (ids, counts, saved or not)
npm run fixture:save -- <subjectId> [--name slug]  # live subject (done runs, mentions, costs, scoped prompts, chats) → db/fixtures/subjects/<slug>.json
npm run fixture:remove -- <slug...>  # delete a saved fixture AND that subject from the live DB
npm run slides:build [-- --theme dark]  # slides/deck.html → self-contained slides.html
npm run report:build                 # report/report.src.html → self-contained report.html (light theme, images inlined)
```

Stop the dev server before `db:reset` / `db:seed` (it holds the SQLite file open). Test logins: `owner1@test.com` / `test1234` (seeded subjects from `db/fixtures/subjects/` — Friend + example chat, Slay the Spire 2 — no tokens spent on start) and `owner2@test.com` / `test1234` (empty; use for tenant-isolation checks). `.claude/launch.json` defines `perspectives-dev` (port 3000) and `slides-preview` (port 4000) for the preview tools.

## Architecture

**Layering.** `app/api/**/route.ts` → `services/*Service.ts` → `db/` (Drizzle over better-sqlite3). Each route folder has a sibling `request.ts` that parses the body with a Zod schema from `lib/validation/` and returns `{ data } | { error }`; the route returns 400 `{ error }` on failure. Routes start with `const user = await requireUser(); if (user instanceof NextResponse) return user;`. Pages use `getCurrentUser()` and redirect; there is no middleware.

**Tenant isolation.** Every service query is scoped to the owner, directly by `owner_id` or by joining through the subject's owner. Another owner's (or malformed) id must surface as 404. Never trust a client-supplied subject/session/prompt id without that check.

**UI wording.** The UI says "tracker" (code, routes, DB stay `subject`), "Search criteria" (prompt kind `fetch`) and "Chat question" (kind `analyst`).

**Single-source configs** — no other file should hardcode these:
- `config/llm.ts`: active provider (Portkey → OpenAI), model, key env var, and per-1M-token pricing. `lib/ai.ts` is the only place that builds the AI SDK model (`getModel()`, `getWebSearchTool()`). Adding a provider = an entry here + a `case` in `lib/ai.ts`.
- `config/brand.ts`: every color (Graphite and lime palette, light/dark themes, plus a `chart` group of sentiment fills `positive`/`neutral`), font, size, spacing, radius. `config/generateCssVars.ts` emits `--brand-*` CSS vars (`--brand-chart-*` too) and CSS `color-scheme` per theme (injected in `app/layout.tsx`); Tailwind v4 maps them in the `@theme inline` block of `app/globals.css` (no tailwind.config). Components use semantic classes (`bg-background`, `text-accent-text`), never hex; only `app/icon.svg` (favicon) has fixed hex, and `components/common/Logo.tsx` strokes with brand vars.
- `lib/env.ts`: reads `.env` files only, in order `final_project/.env`, the repo root, then the folder above the repo (where graders keep theirs); each variable comes from the first file that sets it. It deliberately ignores `process.env`, so a shell variable can't override it. Use `getEnvVar` / `getApiKey` for any new variable.

**Agents** (`agents/`, Vercel AI SDK):
- Fetch: `POST /api/subjects/:id/fetch-runs` returns 201 `{ runs, skipped }` (one pending run per uncovered gap), then runs them in-process one after another: `cadenceWrapper` splits each range into daily/weekly/monthly windows (max 31, checked on the full request) and calls `fetchAgent.fetchWindow()` per window with `fetcherSystemPrompt` + hosted web search; out-of-window results are dropped. Optional search criteria (`criteria`, structured per `lib/searchCriteria.ts`, or raw `instructions`, not both) are rendered to text server-side and snapshotted on `fetch_runs.instructions`; saved ones live in `prompts` (kind `fetch`, JSON in `prompts.criteria`, rendered text in `body`).
- Overlap rule (`planFetchRun` in `fetchRunService`): a date is covered by a `done|pending|running` run with the same trimmed instructions (= rendered search criteria) (`failed` never covers); only the gaps are fetched, and 409 `{ error, skipped }` when nothing is left.
- Analyst: `POST /api/chat-sessions/:id/messages` takes `{ text }` only (history loads from the DB) and streams `analystAgent` (up to 12 steps) with tools in `agents/tools/` (`getMentions`, `getSentimentSummary`, `getThemes`, `getTopSources`, `createVisualization`, `listFetchRuns`, `planFetchRun`, and `listPrompts`/`createPrompt`/`updatePrompt`/`deletePrompt` in `managePrompts.ts`; `createPrompt` takes `body` for a chat question, `criteria` for search criteria). Tools get the owner and subject ids server-side, never from the model; a model-supplied prompt id is owner-checked. The system prompt also lists the tracker's fetched date ranges and saved search criteria (built per turn in `analystAgent.ts`).
- `planFetchRun` input: `{ startDate, endDate, cadence, promptId? | criteria?, followUpQuestion?, fallback? }` (`promptId` = saved search criteria, `criteria` = one-time, neither = none; `fallback` = `{ startDate, endDate }` of the newest fetched dates, only with `followUpQuestion`).
- Missing-data rule (`agents/prompts/analyst.ts`): relative periods ("past week") count back from today; while any of the asked period is unfetched there is no answer from other dates, no chart and no empty table. A relative period with none fetched gets `planFetchRun` right away plus `fallback` = the newest fetched dates of the same length, so the card offers Start fetch or "Use <fallback> instead" (sends the question naming those dates; hidden once a later user message exists); a specific unfetched or partly fetched period gets `planFetchRun` right away for the missing dates only (cadence sized to ≤ 31 windows, the saved criteria only if exactly one, `followUpQuestion` = the question, answered in full after the fetch); a question a card already re-asked after its fetch is answered from stored data, never planned again. A plan with no gaps hides Start fetch. An explicit fetch request still needs all four choices from the owner.
- The LLM never starts a fetch or updates/deletes a prompt; confirm cards do. `CARD_TOOLS` outputs (`createVisualization`, `planFetchRun`, `updatePrompt`, `deletePrompt`) are saved in `chat_messages.payload` (with their `toolCallId`) and rendered by `ChatMessageBubble` (below one "Checking…" / "Checked …" activity line per run of tool calls) as `VisualizationFrame` / `FetchPlanCard` / `PromptUpdateCard` / `PromptDeleteCard`, whose buttons call the normal API routes. `FetchPlanCard` has an Edit mode, records what it started on its own row via `PATCH /api/chat-sessions/:id/fetch-plan` (fixtures remap `started.runIds`), and sends `followUpQuestion` once its runs are done. `FetchSetupCard` is client-only (no tool, no LLM): the first fetch of a tracker with no runs, or a fetch from saved criteria in the chat's side panel (`ChatSidePanel`: Questions / Criteria / Fetches). Cards and the panel reach the chat through the `ChatActions` context.
- `createVisualization` makes a second LLM call (one chart per turn), rewrites any URL not in the subject's stored mentions to `#`, and the HTML is rendered by `VisualizationFrame` in a sandboxed `srcdoc` iframe without `allow-same-origin`.
- Every system prompt in `agents/prompts/` embeds `INJECTION_RULES` from `lib/safety.ts` (web content is data, never instructions). Keep it in any new prompt.
- `chatService` verifies every cited URL in a reply against stored `mentions.url` (live and on reload); unknown URLs get a ⚠ pill.

**Token cost.** `lib/cost.ts` turns AI SDK usage into one `token_usage` row per chat turn (all tool-loop steps plus the visualizer call) and one per fetch window, priced from `config/llm.ts` (gpt-6-luna prices fitted to Portkey's logged costs on 2026-10-25; still an estimate, not the bill). `TokenCostBadge` displays them.

**Database.** `db/client.ts` `getDb()` opens lazily, caches on `globalThis` (survives HMR), enables WAL + foreign keys, applies pending migrations from `db/migrations/` on every start, and seeds when `users` is empty (`db/seed.ts`: the two test owners, then every `db/fixtures/subjects/*.json` alphabetically via `db/fixtures.ts` — all real fetched data, saved from the app with `fixture:save`; the `seed-data` skill wraps save/list/remove). Default path `data/perspectives.db` (gitignored), override with `DATABASE_PATH` in `.env`. All FKs cascade on delete.

**Env.** `.env` needs `PORTKEY_API_KEY` and `SESSION_SECRET` (signs the stateless HMAC session cookie; dev falls back to an insecure secret, production throws). `instrumentation.ts` logs missing values at startup.

## Slides

The deck for the assignment is built by the `slide-dev` skill (`.claude/skills/slide-dev/SKILL.md`): edit `slides/deck.html` (only `<section>` blocks) per `slides/deck.plan.md`, then `npm run slides:build`, which styles it from `config/brand.ts` and inlines `slides/shots/*` as base64 into `slides.html`. Assignment limits: one self-contained reveal.js-from-CDN file, 10 slides max. Don't edit `.claude/skills/slide-dev/example/`. The `devloop` skill has a plan mode (`/devloop plan <idea>` writes `docs/<NAME>_PLAN.md` from `.claude/skills/devloop/plan.template.md`, to run in a fresh session) and a run mode that drives subagents that implement plan tasks and browser-screenshot them (scratch output goes in gitignored `.devloop/`).

## Repo rules

Never commit or push without explicit approval from the user, and only stage files under `final_project/` (the parent repo has unrelated uncommitted homework).
