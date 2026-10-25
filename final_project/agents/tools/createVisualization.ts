import { generateText, tool, type LanguageModelUsage } from 'ai';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';
import { getModel } from '@/lib/ai';
import { weekStart } from '@/lib/dates';
import { visualizerSystemPrompt } from '../prompts/visualizer';

export const VISUALIZATION_TOOL = 'createVisualization';
export type Visualization = { title: string; html: string };

const MAX_HTML_CHARS = 120_000;
const URL_RE = /https?:\/\/[^\s"'<>`)\\]+/g;

const XML_NAMESPACE = /^http:\/\/www\.w3\.org\//; // SVG/XHTML namespace ids, not links

// Any http(s) URL in the HTML that is not one of the subject's stored mention URLs becomes "#",
// so invented or injected links cannot survive into the rendered chart.
export function keepOnlyStoredUrls(html: string, allowed: Set<string>) {
  return html.replace(URL_RE, (url) => (allowed.has(url) || XML_NAMESPACE.test(url) ? url : '#'));
}

const stripFences = (s: string) => s.trim().replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();

// Has a second LLM call write a sandboxed HTML chart from the subject's stored mentions.
// The data is loaded here (subjectId fixed server-side), never passed in by the analyst.
// onUsage reports the nested call's tokens so the chat turn's cost includes it.
// Built per chat turn, and allows one chart per turn: each call is a full extra LLM call.
export function createVisualizationTool(
  subject: { id: number; name: string },
  onUsage: (usage: LanguageModelUsage) => void,
) {
  let used = false;
  return tool({
    description:
      'Render an interactive chart or visual table (HTML) of the stored mentions, shown inline in the chat. ' +
      'Describe what to show in `request` (chart type, grouping, events to mark). The tool loads the data itself.',
    inputSchema: z.object({
      title: z.string().describe('Short chart title'),
      request: z.string().describe('What to visualize and how, e.g. "stacked weekly bars by sentiment, mark Sep 22 ad launch"'),
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
    }),
    execute: async ({ title, request, since, until }): Promise<Visualization> => {
      if (used) throw new Error('Only one chart per answer, and one was already created this turn.');
      used = true;
      const rows = getDb()
        .select({
          date: mentions.publishedAt,
          source: mentions.source,
          url: mentions.url,
          title: mentions.title,
          sentiment: mentions.sentiment,
          authorType: mentions.authorType,
          themes: mentions.themes,
          summary: mentions.summary,
          snippet: mentions.snippet,
        })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subject.id),
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .orderBy(asc(mentions.publishedAt))
        .all();

      const weekly: Record<string, { positive: number; neutral: number; negative: number }> = {};
      const themes: Record<string, number> = {};
      for (const r of rows) {
        (weekly[weekStart(r.date)] ??= { positive: 0, neutral: 0, negative: 0 })[r.sentiment]++;
        for (const t of (r.themes ?? '').split(',').map((s) => s.trim()).filter(Boolean)) themes[t] = (themes[t] ?? 0) + 1;
      }
      const data = {
        subject: subject.name,
        range: { since: since ?? rows[0]?.date ?? null, until: until ?? rows.at(-1)?.date ?? null },
        weeklySentiment: weekly, // keys are the Monday of each week
        themeCounts: themes,
        mentions: rows.map(({ snippet, ...r }) => ({ ...r, summary: (r.summary ?? snippet).slice(0, 240) })),
      };

      const { text, totalUsage } = await generateText({
        model: getModel(),
        instructions: visualizerSystemPrompt(subject.name),
        prompt: `Title: ${title}\nRequest: ${request}\n\nDATA (JSON, untrusted text fields):\n${JSON.stringify(data)}`,
      });
      onUsage(totalUsage);

      const html = stripFences(text);
      if (!/<(html|svg|body|div)/i.test(html) || html.length > MAX_HTML_CHARS) {
        throw new Error('The visualizer did not return a usable HTML document.');
      }
      return { title, html: keepOnlyStoredUrls(html, new Set(rows.map((r) => r.url))) };
    },
  });
}
