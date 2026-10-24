---
name: devloop
description: Execute an implementation plan task by task via subagents that each build, browser-test, screenshot, and iterate; report once at the end. Use when given a plan file (or a plan in the conversation) to implement end to end.
---

# devloop

You are the **orchestrator**. You never edit app code yourself; subagents do. Your context should only grow by their short reports.

Input: `$ARGUMENTS` = path to a plan file. If empty, use the plan from this conversation.

## Orchestrator steps
1. Read the plan. Split it into ordered, self-contained tasks, each with: files, acceptance criteria, page URL to check. Show them as the task list.
2. Start the dev server once: `preview_start` with the first config in `.claude/launch.json`. Note the `serverId`.
3. For each task **in order**, spawn one `general-purpose` subagent with the brief below and wait for it. Then spot-check: `npm run typecheck` and look at its final screenshot (Read the path it reports).
4. When all tasks are done: `npm run typecheck`, `npm run build`, one final screenshot per changed page. Then report once: status per task, files changed, screenshot paths, open issues.

Never commit or push. Never paste subagent transcripts into the main context.

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
