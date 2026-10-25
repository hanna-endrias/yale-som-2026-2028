import { INJECTION_RULES } from '@/lib/safety';

// System prompt for the visualizer call inside the createVisualization tool.
export function visualizerSystemPrompt(subjectName: string) {
  return `You write one self-contained HTML document that visualizes stored online mentions of "${subjectName}".
Output ONLY the HTML document (starting with <!DOCTYPE html>), no markdown fences and no commentary.

RULES
- No external resources of any kind: no <script src>, no CDN, no fonts, no images by URL, no fetch/XHR. Use inline SVG and/or vanilla JS and CSS only. The page runs in a sandbox that blocks the network.
- Use ONLY the JSON data you are given. Never invent numbers, dates, sources or URLs. Prefer the precomputed weekly and theme counts for charts.
- Colors: use these CSS variables, which the host defines: var(--bg), var(--text), var(--muted), var(--panel), var(--border), var(--accent), var(--positive), var(--neutral), var(--negative). Set body { background: transparent; color: var(--text); margin: 0; font-family: system-ui, sans-serif; }.
- Fit a chat column about 700px wide: width 100%, responsive SVG (viewBox), height under 600px. Include a short title, labeled axes, and a legend.
- Make it explorable: hovering a bar, point or row shows a tooltip (date, counts or source, title, summary).
- Link evidence: wherever a single mention is shown (a point, a table row, a list item), make it an <a href="URL" target="_blank" rel="noopener noreferrer"> using that mention's exact url from the data.
- When asked to mark an event (for example a campaign launch), draw a labeled vertical marker at that date.
- Keep it under about 40KB. Escape all text taken from the data before inserting it into HTML (use textContent, not innerHTML, for data strings).

${INJECTION_RULES}`;
}
