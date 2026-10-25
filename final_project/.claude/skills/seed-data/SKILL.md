---
name: seed-data
description: Save a subject Hanna fetched in the app (its runs, mentions, token costs, scoped prompts and chats) as Perspectives seed data so it survives db:reset/db:seed, list what is saved, or remove saved subjects (file and live DB), e.g. to clean up before turning the project in. Use when asked to keep, store, seed, save, list, remove, or clean up test/fetched data or fixtures.
---

# seed-data

Seed data is one JSON file per subject in `db/fixtures/subjects/<slug>.json`. On a fresh start (`npm run dev` on an empty DB, `db:reset`, `db:seed`), `db/seed.ts` loads every file there in alphabetical order, under the owner saved in the file (`owner1@test.com` / `owner2@test.com`). The code lives in `db/fixtures.ts` and `scripts/fixtures.ts`. Run every command from `final_project/`.

Input: `$ARGUMENTS`, one of:
- **`save <subject name or id> [as <slug>]`**: store a fetched subject.
- **`list`** (or no arguments): show what is saved and what is in the live DB.
- **`remove <slug or subject name> [...]`**: delete saved subjects.
- **`cleanup`**: walk through removing test data before turn-in.

## Rules
- Nothing here calls the LLM or spends tokens. Never trigger a fetch run or a chat to "make" data. Saving only copies what is already in the live DB.
- Never commit or push. Fixture files are tracked by git, so after a save or remove, say which files changed and that they are not committed.
- Always confirm with Hanna before a remove. It deletes the file **and** the subject from the live DB, and the only way back is git (`git checkout -- db/fixtures/subjects/<slug>.json`) for a committed file. An uncommitted fixture is gone for good.

## save
1. Run `npm run fixture:list` and find the subject in **Live DB subjects** by name (case-insensitive) or id. If the name matches more than one, or none, ask which one.
2. Run `npm run fixture:save -- <id>`. Add `--name <slug>` only if Hanna gave one. The default slug is the subject name slugified (e.g. `slay-the-spire-2`). Saving the same subject again overwrites its file, which is how to add newer runs or chats.
3. Report the line the script printed (runs, mentions, prompts, chats). If it says runs were skipped, say why: only `done` runs are saved, so a pending or failed run stays out.
4. Mention that it loads on the next `npm run db:seed` (dev server stopped) and is not committed.

What is saved: the subject's fields and owner; every `done` fetch run with its mentions and per-window `token_usage` rows; library prompts scoped only through `prompt_subjects` (not all-subject prompts); and every chat session with its messages, chart payloads and per-turn token usage.

## list
Run `npm run fixture:list` and summarize both sections. Point out live subjects marked `[not saved]` (they disappear on the next reset) and saved fixtures whose subject is not in the live DB.

## remove
1. Run `npm run fixture:list`. Map each requested name to a saved slug. If nothing matches, show the saved slugs and stop.
2. Tell Hanna exactly what will go: for each slug, the file and the live subject (with its runs, mentions, chats, token rows, and prompts scoped only to it). Then ask for confirmation.
   - Removing **`friend`** leaves owner1 with no seeded subject. `slides/deck.plan.md`, `slides/deck.html`, `README.md` and `docs/ARCHITECTURE.md` describe Friend and its numbers (12 weekly searches, 50 mentions), so flag them as needing an update.
3. On a yes, run `npm run fixture:remove -- <slug> [<slug> ...]` and report its output.
4. Suggest `npm run db:seed` (dev server stopped) to check that the seed now matches the saved files.

## cleanup (before turn-in)
1. Run `npm run fixture:list`.
2. Ask which saved subjects to keep for grading. Friend is the documented demo, so suggest keeping it unless Hanna says otherwise.
3. Remove the rest as in **remove**, with one confirmation for the whole set.
4. Offer to run `npm run db:seed` and confirm the counts. Then list the changed files under `db/fixtures/subjects/` for Hanna to review and commit.
