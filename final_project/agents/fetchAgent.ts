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
      source: z.string().describe('Site or outlet name, e.g. "reddit.com"'),
      url: z.string().describe('Exact URL of the page found in search results'),
      snippet: z.string().describe('Short quote or summary of what is said about the subject'),
      publishedAt: z.string().describe('Publication date, YYYY-MM-DD'),
      sentiment: z.enum(['positive', 'neutral', 'negative']),
    }),
  ),
});

export type FetchWindowResult = Awaited<ReturnType<typeof fetchWindow>>;

// One cadence window: a single web-search-backed call returning structured mentions plus token usage.
export async function fetchWindow(subject: FetchSubject, window: Window, instructions?: string) {
  const { output, totalUsage } = await generateText({
    model: getModel(),
    tools: { web_search_preview: getWebSearchTool() },
    output: Output.object({ schema: mentionsSchema }),
    instructions: fetcherSystemPrompt(subject, instructions),
    prompt: `Find mentions published between ${window.start} and ${window.end} (inclusive). Return at most 10.`,
  });
  return { mentions: output.mentions, usage: totalUsage };
}
