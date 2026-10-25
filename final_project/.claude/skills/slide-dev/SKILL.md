---
name: slide-dev
description: Build or update the MGT 409 final-project slide deck (slides.html) for Perspectives — reveal.js, styled from the brand kit in config/brand.ts, with app screenshots captured through the devloop skill and embedded so the file opens by double-click. Use when asked to make, update, restyle, or re-screenshot the slides/deck/presentation.
---

# slide-dev

You are the **orchestrator** for the final-project deck. Output: `final_project/slides.html`. Run every command from `final_project/`.

Input: `$ARGUMENTS` — one of:
- **`rebuild`** — restyle only, e.g. after changing `config/brand.ts`. Content and screenshots stay; see [Rebuild mode](#rebuild-mode). Add `--reshoot` to also re-capture the app screenshots so they show the new brand.
- **a path to a deck plan** (default `slides/deck.plan.md`), plus any notes — full run, steps 0–6. The plan follows [deck-plan.template.md](deck-plan.template.md) and is the source of truth for theme, slide order, headlines, visuals, numbers, and screenshots.

**Example:** [example/](example/) holds a finished deck (`deck.plan.md` + `deck.html`). Use it as the reference for plan wording and markup patterns (class usage, the SVG diagram, stat cards), not as content. Never edit it during a run. `slides/` is working output: a full run overwrites `deck.html` and any screenshots it re-captures.

## Assignment rules (project_requirements.html — non-negotiable)
- One self-contained HTML file, **reveal.js from a CDN**, arrow keys to navigate, F for full screen.
- **10 slides max.** Screenshots and the agent diagram are **embedded** in the file.
- Graded on: tells the whole story in a few minutes **with a diagram, screenshots, and the key numbers** (6 pts); big readable text, consistent style, visuals carry the story (2 pts).
- Suggested order: 1 Title (name, Hanna Endrias, one-line pitch) · 2 Problem + who has it · 3 What's new · 4 How the agents work (diagram) · 5 Demo screenshots · 6 Cost to run · 7 Safety · 8 Impact: the numbers · 9 What's next.

## Files
| Path | What |
|---|---|
| `slides/deck.plan.md` | Deck plan (from the template). What the deck says. |
| `slides/deck.html` | Source: only `<section>` blocks. You edit this. |
| `slides/shots.plan.md` | Capture plan handed to devloop. |
| `slides/shots/*.jpg` | Embedded screenshots. |
| `scripts/build-slides.ts` | `npm run slides:build` → `slides.html`. Theme comes from the plan's `Theme:` line (override with `-- --theme dark`). Every color, font, radius and spacing comes from `config/brand.ts` via `config/generateCssVars.ts` at build time, so a rebuild picks up brand-kit changes. Images are inlined as base64. |

Never edit `slides.html` by hand, and never put raw hex in `deck.html` — use the classes below or `var(--brand-…)`. To change colors or fonts, change `config/brand.ts` (that also changes the app).

## Steps

0. **Get a deck plan.** If the plan file exists, read it and go to step 2. If not, help fill in the template:
   - Copy `deck-plan.template.md` to `slides/deck.plan.md` and draft every field yourself (see `example/deck.plan.md` for the level of detail) from step 1's sources, following the suggested order. Mark anything you can't source as `TODO`.
   - Ask the user (AskUserQuestion, one round, ≤ 4 questions) only what the sources can't answer: theme, audience/time, and any `TODO` they can fill now (e.g. a user quote, time saved).
   - Save the plan, show it to the user, and continue once they're happy with it.

1. **Gather content** (read, don't guess): `docs/PRODUCT.md` (motivation, what's new, tokenomics, safety, limits), `docs/ARCHITECTURE.md`, `agents/*.ts` + `agents/prompts/*` + `config/llm.ts` (agent roles, tools, models), `README.md`, real token counts from `db/fixtures/*.json` / the TokenCostBadge data. **Never invent a number, quote, or competitor claim.** If a slide needs something you don't have (e.g. a user quote, time saved), put `<span class="todo">TODO: …</span>` on it and list it in the report. Overwrite `deck.html` from the plan; don't preserve earlier content the plan doesn't ask for.

2. **Write `slides/deck.html`** from the plan, one `<section>` per plan slide, in plan order. Each slide: one idea, a headline that states the takeaway (not a topic label), ≤ ~30 words of body, nothing under `.small`. Slide 4 is an inline `<svg class="diagram" viewBox="0 0 1200 520">` of the agents (user → fetch agent / analyst agent → tools → visualizer, models labelled) using `fill="var(--brand-color-panel)"`, `stroke="var(--brand-color-border)"`, `var(--brand-palette-primary)` / `var(--brand-palette-secondary)` for arrows and highlights.

3. **Screenshots via devloop.** Take the plan's "Screenshots needed" table (plus any other `src="shots/…"` in the deck). For each one missing from `slides/shots/`, first check `.devloop/screenshots/**` for one that already fits (copy it in). For the rest, write `slides/shots.plan.md` — one task each, in this shape:
   ```
   ## Task: <shot-name>
   Files: none (capture only)
   Page: /chat/<id>            (find real ids via the sidebar after login)
   Login: owner1@test.com / test1234
   Theme: <same as deck>
   Viewport: 1280x800
   State: <exact UI state, e.g. "Friend subject open, seeded chat scrolled so the sentiment chart and citations are both visible">
   Output: slides/shots/<shot-name>.jpg
   ```
   Then invoke the **devloop** skill with `slides/shots.plan.md`. Good default shots: chat answer with chart + citations, sidebar with trackers/sessions, chat side panel Fetches tab (monthly cadence), first-fetch setup card, prompt library, prompt-injection refusal (safety), token cost badge. Avoid shots that call Portkey unless a fresh one is truly needed (tokens cost money); prefer seeded data.

4. **Build**: `npm run slides:build` (theme from the plan). It fails loudly on a missing image and warns past 10 slides.

5. **Polish loop (like devloop).** `preview_start` `slides-preview` once and note the `serverId`. Spawn one `general-purpose` subagent with the brief below and wait. It iterates on screenshots of the rendered slides until they look right, so your context only grows by its report. Then spot-check: Read 2–3 of its final slide screenshots yourself (title, diagram, one screenshot slide). If one still fails the checklist, send the subagent the specific fixes (SendMessage) for one more round.

6. **Report** in ≤ 150 words: slide titles in order, screenshots used, final slide screenshot folder, every TODO still on a slide, theme. **Never commit or push** — Hanna approves commits.

## Rebuild mode
For `rebuild` (brand-kit or build-script changes only — no content changes):
1. `npm run slides:build`.
2. With `--reshoot`: re-run step 3 for every shot in the plan's "Screenshots needed" table (re-capture all of them, even ones that exist), then build again.
3. Quick check, no polish loop: `preview_start` `slides-preview`, open `http://localhost:4000/slides.html`, run step 5's mechanical checks (slide count, `data:` images, no overflow, no console errors), and screenshot the title slide plus one stats slide and one screenshot slide to confirm the new brand is applied and text still contrasts. If a brand change broke the layout (e.g. a wider font now overflows), fall back to the polish loop (step 5).
4. Report in ≤ 60 words: what rebuilt, whether shots were re-captured, any issue. Without `--reshoot`, note that app screenshots still show the old brand.

## Polish subagent brief (fill in the brackets)
```
Polish the slide deck in final_project/ (run all commands from there). Edit only slides/deck.html
(and crop slides/shots/ images in place, keeping their names, if needed); never edit slides.html by hand, never use raw hex — use the
classes in .claude/skills/slide-dev/SKILL.md or var(--brand-…). Do not invent numbers or quotes;
keep every .todo placeholder visible.

Deck viewer: http://localhost:4000/slides.html  (static server already running, serverId [id]; don't stop it)
Theme: [light|dark]   Notes from the user: [notes]

Loop (max 5 rounds) until every slide passes the checklist:
1. `npm run slides:build`.
2. preview_eval `location.reload()`, wait for load. preview_console_logs level error must be empty.
3. Mechanical checks via preview_eval: Reveal.getTotalSlides() <= 10; every img.src starts with
   "data:"; for each i, Reveal.slide(i) then the current section's scrollHeight <= 720.
4. For each slide i: preview_eval `Reveal.slide(i)`, preview_screenshot, and look at it against:
   - Readable from the back of a room: body ≥ ~28px, nothing in .small except captions/sources.
   - One idea; headline states the takeaway; ≤ ~30 words of body.
   - Nothing clipped, overlapping, or touching the edges; balanced whitespace; aligned columns.
   - Screenshots sharp and large enough to read the key UI; cropped to what matters.
   - Diagram labels legible, arrows clear, flow reads left→right or top→bottom.
   - Consistent across slides: same heading position, eyebrow style, spacing, accent use.
   - The deck tells the story: problem → new → agents → demo → cost → safety → impact → next,
     with a diagram, screenshots, and the key numbers present.
5. Fix every failure in slides/deck.html (cut words, split into .cols, resize/crop shots, adjust the
   SVG), then go to 1.

When done, preview_resize preset desktop, and copy each final slide screenshot (the
"[Image: source: …]" path) to .devloop/screenshots/slides/NN-<slug>.jpg.

Reply in at most 150 words: status (done/failed), rounds used, what you changed, final screenshot
folder, any slide that still fails and why. No code.
```

## Classes available in deck.html
| Class | Use |
|---|---|
| `div.title-slide` (inside the `<section>`) | Title slide: centered vertically, brand gradient bar. Use `<h1>`, `.lead`. Not on the section itself: reveal copies section classes onto the background. |
| `.eyebrow` | Small uppercase label above a headline (e.g. "The problem"). |
| `.lead` | Large muted subtitle. |
| `.cols` / `.cols.wide-right` | Two columns (1:1 / 2:3) — text left, screenshot right. |
| `.cards` > `.card` (`h3` + `p`) | Side-by-side panels (comparisons, safety defenses, next steps). |
| `.stat` + `.stat-label` | Big number with label, put in a `.card` for KPI rows. |
| `img.shot`, `.shots` | Framed screenshot / row of screenshots. `.caption` under one. |
| `.accent`, `strong`, `.muted` | Brand accent text / muted text. |
| `.todo` | Visible red placeholder for missing evidence. |
| `svg.diagram` | Agent diagram. |
