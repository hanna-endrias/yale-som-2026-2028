import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getModel, getWebSearchTool } from '@/lib/ai';
import { fetcherSystemPrompt } from './prompts/fetcher';

export type Window = { start: string; end: string };
export type FetchSubject = {
  name: string;
  description: string;
  location: string | null;
  website: string | null;
  searchTerms: string;
};

const mentionsSchema = z.object({
  mentions: z.array(
    z.object({
      source: z.string().describe('Site or outlet domain, e.g. "reddit.com"'),
      url: z.string().describe('Exact URL of the page found in search results'),
      title: z.string().describe('Page, article or post title'),
      snippet: z.string().describe('One-line gist of what is said about the subject'),
      summary: z.string().describe('2-4 sentences: what the piece says about the subject, the reasons given, and who is speaking'),
      quote: z
        .string()
        .nullable()
        .describe('A short verbatim excerpt about the subject exactly as it appears in the search result, or null if none was shown'),
      themes: z.array(z.string()).describe('2-4 short lowercase topics, e.g. "privacy", "ad campaign", "price"'),
      authorType: z.enum(['press', 'social', 'forum', 'review', 'brand', 'other']),
      publishedAt: z.string().describe('Publication date, YYYY-MM-DD'),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
    }),
  ),
});

const MAX_MENTIONS_PER_WINDOW = 15;

export type FetchWindowResult = Awaited<ReturnType<typeof fetchWindow>>;

// One cadence window: a single web-search-backed call returning structured mentions plus token usage.
export async function fetchWindow(subject: FetchSubject, window: Window, instructions?: string) {
  const { output, totalUsage } = await generateText({
    model: getModel(),
    tools: { web_search_preview: getWebSearchTool() },
    output: Output.object({ schema: mentionsSchema }),
    instructions: fetcherSystemPrompt(subject, instructions),
    prompt: `Find mentions published between ${window.start} and ${window.end} (inclusive). Return at most ${MAX_MENTIONS_PER_WINDOW}.`,
  });
  // Stored shape: themes as a comma-separated string; anything dated outside the window is dropped.
  const inWindow = output.mentions.filter((m) => m.publishedAt >= window.start && m.publishedAt <= window.end);
  return { mentions: inWindow.map((m) => ({ ...m, themes: m.themes.join(', ') })), usage: totalUsage };
}
