import { tool } from 'ai';
import { and, desc, eq, gte, like, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';

// subjectId is fixed server-side; the model can only filter within that subject.
export function getMentionsTool(subjectId: number) {
  return tool({
    description:
      'List stored mentions (newest first) with url, title, summary, verbatim quote, themes and author type. ' +
      'Filter by sentiment, source, author type, theme, free text, and date range. Use the url to cite a mention.',
    inputSchema: z.object({
      sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
      source: z.string().optional().describe('e.g. "reddit.com"'),
      authorType: z.enum(['press', 'social', 'forum', 'review', 'brand', 'other']).optional(),
      theme: z.string().optional().describe('Theme substring, e.g. "privacy"'),
      text: z.string().optional().describe('Substring searched in title, snippet, summary and quote'),
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      limit: z.number().int().min(1).max(60).default(25),
    }),
    execute: async ({ sentiment, source, authorType, theme, text, since, until, limit }) =>
      getDb()
        .select({
          publishedAt: mentions.publishedAt,
          source: mentions.source,
          url: mentions.url,
          title: mentions.title,
          sentiment: mentions.sentiment,
          authorType: mentions.authorType,
          themes: mentions.themes,
          snippet: mentions.snippet,
          summary: mentions.summary,
          quote: mentions.quote,
        })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subjectId),
            sentiment ? eq(mentions.sentiment, sentiment) : undefined,
            source ? eq(mentions.source, source) : undefined,
            authorType ? eq(mentions.authorType, authorType) : undefined,
            theme ? like(mentions.themes, `%${theme}%`) : undefined,
            text
              ? or(
                  like(mentions.title, `%${text}%`),
                  like(mentions.snippet, `%${text}%`),
                  like(mentions.summary, `%${text}%`),
                  like(mentions.quote, `%${text}%`),
                )
              : undefined,
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .orderBy(desc(mentions.publishedAt))
        .limit(limit)
        .all(),
  });
}
