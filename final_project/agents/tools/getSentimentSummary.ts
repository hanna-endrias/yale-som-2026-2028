import { tool } from 'ai';
import { and, count, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { mentions } from '@/db/schema';
import { weekStart } from '@/lib/dates';

type Counts = { positive: number; neutral: number; negative: number };

// Mention counts per day or per Monday-start week, by sentiment, for one subject (subjectId fixed server-side).
export function getSentimentSummaryTool(subjectId: number) {
  return tool({
    description:
      'Count mentions by sentiment (positive/neutral/negative) per day or per week (weeks start Monday, keyed by that Monday), ' +
      'optionally within a date range. Periods with no mentions are omitted.',
    inputSchema: z.object({
      groupBy: z.enum(['day', 'week']).default('day'),
      since: z.string().optional().describe('YYYY-MM-DD, inclusive'),
      until: z.string().optional().describe('YYYY-MM-DD, inclusive'),
    }),
    execute: async ({ groupBy, since, until }) => {
      const rows = getDb()
        .select({ date: mentions.publishedAt, sentiment: mentions.sentiment, count: count() })
        .from(mentions)
        .where(
          and(
            eq(mentions.subjectId, subjectId),
            since ? gte(mentions.publishedAt, since) : undefined,
            until ? lte(mentions.publishedAt, until) : undefined,
          ),
        )
        .groupBy(mentions.publishedAt, mentions.sentiment)
        .orderBy(mentions.publishedAt)
        .all();

      const byPeriod: Record<string, Counts> = {};
      const totals: Counts = { positive: 0, neutral: 0, negative: 0 };
      for (const r of rows) {
        const key = groupBy === 'week' ? weekStart(r.date) : r.date;
        byPeriod[key] ??= { positive: 0, neutral: 0, negative: 0 };
        byPeriod[key][r.sentiment] += r.count;
        totals[r.sentiment] += r.count;
      }
      return { groupBy, totals, byPeriod };
    },
  });
}
