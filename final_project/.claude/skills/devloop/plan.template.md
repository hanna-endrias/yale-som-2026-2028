# Perspectives — [feature name] plan

> **Standalone plan.** This is meant to start a fresh session, so don't assume any earlier context. All work is in `C:\Users\hanna\Documents\AI\AI_HW\final_project`. Run it with `/devloop docs/[NAME]_PLAN.md`.

## Before you start: read the current codebase
[Say whether the docs are in sync with the code. If not: "trust the code over the docs".]

1. **Docs, for intent and conventions:**
   - `CLAUDE.md`
   - `docs/PRODUCT.md` [§ that matters]
   - `docs/ARCHITECTURE.md`, especially [§s this plan touches]
   - `README.md` "Local dev": test logins, `db:reset` / `db:seed`
2. **Code this plan changes:**
   - [path — one line on why]
3. **Patterns to copy:**
   - Data: [e.g. `db/schema.ts`, `db/seed.ts`]
   - API: [e.g. `services/subjectService.ts`, `lib/validation/subjects.ts`, `app/api/subjects/[subjectId]/{route,request}.ts`]
   - UI: [closest existing component(s)]
4. **Run the app:**
   - `preview_start "perspectives-dev"`, log in as `owner1@test.com` / `test1234` (Friend subject + example chat). `owner2@test.com` / `test1234` is empty.
   - **LLM calls spend real tokens.** Keep chat turns and fetch runs to the minimum each step's Check needs. [Say which steps need none.]

## Context
[What exists today, concretely: which file does what, what's hardcoded, what's missing.]

Hanna wants:
1. [outcome]
2. [outcome]

Decisions made (asked):
- [question → answer]

Ground rules:
- DON'T OVER-ENGINEER.
- Brand tokens only (`config/brand.ts` → Tailwind semantic classes), never raw hex.
- Follow the route.ts + request.ts → services → lib/validation pattern; every query scoped to the owner (404 otherwise).
- New LLM prompts embed `INJECTION_RULES`; only `config/llm.ts` / `lib/ai.ts` name a provider or model.
- `npm run typecheck` passes after every step.
- Nothing is committed or pushed unless Hanna asks.
- No docs are synced (ARCHITECTURE.md, PRODUCT.md) until Hanna has reviewed and tested. That is the last step.

---

## What gets removed / refactored
| Where | Today | After |
|---|---|---|
| `[path]` | [current behavior] | [new behavior] |

## Data model
[Only if the schema changes. New tables/columns with types, FKs (cascade), defaults. "New migration via `npm run db:generate`". Any seed/fixture changes. Otherwise delete this section.]

---

## [ ] Step 1 — [name] [(no behavior change) if a pure refactor]
- [What to build, file by file. Name functions, props, routes, limits.]
- [Wireframe in a code block for any new or changed UI.]

**Check:** [How the subagent proves it works: what to click, what the page/API/DB shows, the owner2 isolation case, edge cases rejected. Say how many LLM calls, or "No LLM calls are needed".]

## [ ] Step 2 — [name]
- [...]

**Check:** [...]

## [ ] Step N — Wrap up and hand off
- Run `npm run typecheck` and `npm run build`, and take final screenshots of [changed pages / states].
- [README note if setup changed, e.g. "after pulling, run `npm run db:reset`".]
- **Stop.** Tell Hanna it's ready to review, and give her the Verification checklist below. Don't continue to the next step until she approves.

---

## Verification (for Hanna's review)
1. Stop the server, run `npm run db:reset`, then `npm run dev`.
2. As owner1, [walk through the feature end to end, with what she should see].
3. As owner2, [what must stay invisible / return 404].
4. [Token-spending check, if any, kept small.]

---

## [ ] Step N+1 — Only after Hanna has reviewed, tested and approved: sync the docs
- **`docs/ARCHITECTURE.md`:** match what is actually built — [§2 file tree, §3 tables, §4 API table, §6 component map, any new section].
- **`docs/PRODUCT.md`:** touch only what became wrong.
- **`CLAUDE.md` / `README.md`:** update commands or architecture notes that changed.
- **Cleanup:** delete `docs/[NAME]_PLAN.md` and remove any links to it.
