import { tool } from 'ai';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';

// Theme counts by sentiment for one subject (subjectId fixed server-side), parsed from mentions.themes.
export function getThemesTool(subjectId: number) {
  return tool({
    description:
      'Rank the themes (topics) people discuss about the subject, with counts by sentiment, optionally within a date range.',
    inputSchema: z.object({
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      limit: z.number().int().min(1).max(30).default(12),
    }),
    execute: async ({ since, until, limit }) => {
      const rows = getDb()
        .select({ themes: mentions.themes, sentiment: mentions.sentiment })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subjectId),
            isNotNull(mentions.themes),
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .all();

      const byTheme = new Map<string, { theme: string; total: number; positive: number; neutral: number; negative: number }>();
      for (const r of rows) {
        for (const theme of (r.themes ?? '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)) {
          const row = byTheme.get(theme) ?? { theme, total: 0, positive: 0, neutral: 0, negative: 0 };
          row.total++;
          row[r.sentiment]++;
          byTheme.set(theme, row);
        }
      }
      return [...byTheme.values()].sort((a, b) => b.total - a.total).slice(0, limit);
    },
  });
}
