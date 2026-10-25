---
name: devloop
description: Write an implementation plan from the template (asking Hanna for the decisions it needs), or execute a plan task by task via subagents that each build, browser-test, screenshot, and iterate; report once at the end. Use when asked to plan a feature for devloop, or when given a plan file (or a plan in the conversation) to implement end to end.
---

# devloop

Two modes, picked from `$ARGUMENTS`:
- **`plan [idea]`**, or empty with no plan in the conversation → [Plan mode](#plan-mode): write a plan file to run in a fresh session. Don't implement anything.
- **a path to a plan file**, or empty with a plan in the conversation → [Run mode](#run-mode).

## Plan mode
Output: `docs/[NAME]_PLAN.md`, filled in from [plan.template.md](plan.template.md). The plan must stand alone: a fresh session with no memory of this one runs it.

1. **Get the idea.** If `$ARGUMENTS` has none, ask Hanna what she wants built and why, in one question.
2. **Read before asking.** `CLAUDE.md`, the relevant `docs/ARCHITECTURE.md` sections, and the code the feature touches (use an Explore subagent if it spans many files). Note what exists today, what's hardcoded, and the closest existing pattern to copy.
3. **Ask only real decisions** with AskUserQuestion (up to 4 per call, recommended option first): where it lives in the UI, what's seeded, scope, behavior on click, anything that changes the data model. Don't ask what the code or the ground rules already answer. Record each answer under "Decisions made (asked)".
4. **Fill the template.**
   - Steps are ordered so each leaves the app running and typechecking; a pure refactor goes first and says "(no behavior change)".
   - Each step names files, functions, routes and limits concretely, has a wireframe for new UI, and ends in a **Check:** a subagent can actually run in the browser, including the owner2 isolation case and how many LLM calls it spends.
   - Keep the last two steps: the wrap-up that **stops** for Hanna's review, and the doc sync that only runs after she approves.
   - Delete sections that don't apply (e.g. Data model) and every `[bracket]`.
5. **Write and hand off.** Write `docs/[NAME]_PLAN.md`, show Hanna the step list in a few lines, and tell her to run `/devloop docs/[NAME]_PLAN.md` in a fresh session. Revise on feedback; never start implementing in this session.

## Run mode
You are the **orchestrator**. You never edit app code yourself; subagents do. Your context should only grow by their short reports.

Input: `$ARGUMENTS` = path to a plan file. If empty, use the plan from this conversation.

1. Read the plan, including its "Before you start" list. Split it into ordered, self-contained tasks, each with: files, acceptance criteria (the step's **Check**), page URL to check. Skip steps already ticked `[x]`. Show them as the task list.
2. Start the dev server once: `preview_start` with the first config in `.claude/launch.json`. Note the `serverId`.
3. For each task **in order**, spawn one `general-purpose` subagent with the brief below and wait for it. Then spot-check: `npm run typecheck` and look at its final screenshot (Read the path it reports). If the plan is a file, tick that step `## [x]` there.
4. When all tasks are done: `npm run typecheck`, `npm run build`, one final screenshot per changed page. Then report once: status per task, files changed, screenshot paths, open issues.

**Stop steps.** A step that says **Stop** (the wrap-up and hand-off) ends the run: report, give Hanna the plan's Verification checklist, and don't run any later step (e.g. "Only after Hanna has … approved") until she says she approved it.

Never commit or push. Never paste subagent transcripts into the main context.

## Capture-only tasks
A task with `Files: none (capture only)` (e.g. from the slide-dev skill's `slides/shots.plan.md`) changes no code. Use the capture brief below instead of the implement brief, and skip typecheck/build for it. A plan made only of capture tasks ends with a list of output paths, not a build.

```
Capture a screenshot of the running app in final_project/. Change no code.

Shot: [name]
Page: http://localhost:3000[path]
Login: [email / password]   Theme: [light|dark]   Viewport: [WxH]
State: [exact UI state]
Output: [output path]
Dev server: already running, serverId [id]. Do not start or stop it.

1. preview_resize to the viewport. If not logged in, log in at /login.
2. Set the theme: preview_eval `document.cookie = 'theme=[theme]; path=/'`, then reload.
3. Navigate to the page and set up the state (preview_snapshot, preview_click, scrolling via preview_eval).
   Use seeded data; don't send chat messages unless the state requires a fresh answer.
   Hide the Next.js dev badge: preview_eval `document.querySelectorAll('nextjs-portal').forEach(e => e.style.display = 'none')`.
4. preview_screenshot and look at it: state matches, no spinners, no error toasts, nothing cut off. Retry up to 3 times.
5. Copy the screenshot (the "[Image: source: …]" path) to the output path. preview_resize preset desktop.

Reply in at most 80 words: status, output path, anything that didn't match the requested state.
```

## Subagent brief (fill in the brackets)
```
Implement this task in final_project/ (run all commands from there).

Task: [task]
Files: [files]
Acceptance criteria: [criteria]
Page to check: http://localhost:3000[path]
Dev server: already running, serverId [id]. Do not start or stop it.

Rules: style only with brand tokens via Tailwind (bg-background, text-accent-text, p-md…), never raw hex;
colors/fonts/sizes live in config/brand.ts. Follow the folder layout in docs/ARCHITECTURE.md §2.
Only call Portkey routes when this task needs it (each call spends tokens).

Loop (max 5 rounds) until every criterion passes:
1. Edit code, then `npm run typecheck`.
2. Navigate: preview_eval `location.href = '<page>'`, wait for load.
3. Test behavior: preview_snapshot, preview_click, preview_fill.
4. preview_screenshot; preview_resize mobile → screenshot → reset to desktop if layout changed.
5. preview_console_logs (level error) and preview_logs for errors; preview_inspect to confirm exact colors/sizes.
6. Fix anything wrong and repeat.

Copy each final screenshot (the "[Image: source: …]" path) to .devloop/screenshots/[task-slug]/ with a descriptive name.

Reply in at most 150 words: status (done/failed), files changed, what you tested, screenshot paths, open issues. No code.
```
