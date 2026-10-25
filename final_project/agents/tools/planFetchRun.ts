import { tool } from 'ai';
import { z } from 'zod';
import { normalizeCriteria, searchCriteriaSchema } from '@/lib/searchCriteria';
import { createFetchRunSchema, fetchFallbackSchema } from '@/lib/validation/fetchRuns';
import { planFetchRun } from '@/services/fetchRunService';
import { listPrompts } from '@/services/promptService';

export const PLAN_FETCH_TOOL = 'planFetchRun';

// Plans a fetch (gaps not yet covered with the same search criteria) and shows it as a card with a Start button.
// Never starts anything: only the owner's click on the card does. Owner and subject are fixed server-side.
export function planFetchRunTool(ownerId: number, subject: { id: number; name: string }) {
  return tool({
    description:
      'Plan a fetch of new mentions for this tracker: once the user has given start date, end date, cadence and a search criteria choice, ' +
      'or right away when they ask about specific dates never fetched or a partly fetched period (pass only the missing dates and followUpQuestion), ' +
      'or right away for a relative period (e.g. "past week") never fetched (then also pass fallback = the newest fetched dates of the same length). ' +
      'Shows the user a plan card with a Start button and an Edit link (plus a "Use <fallback> instead" button when fallback is set); ' +
      'it does NOT start the fetch. Pass promptId (saved search criteria), or criteria (new one-time search criteria), or neither (no criteria).',
    inputSchema: z.object({
      startDate: z.string().describe('YYYY-MM-DD'),
      endDate: z.string().describe('YYYY-MM-DD, inclusive'),
      cadence: z.enum(['daily', 'weekly', 'monthly']),
      promptId: z.number().int().optional().describe('Id of saved search criteria (listPrompts kind "fetch")'),
      criteria: searchCriteriaSchema
        .optional()
        .describe('New one-time search criteria: sources, topics, excludeKeywords, region, language, notes (all optional)'),
      followUpQuestion: z
        .string()
        .max(500)
        .optional()
        .describe("The owner's question, word for word, when this fetch is for dates they asked about; it is asked again once the fetch is done"),
      fallback: z
        .object({ startDate: z.string().describe('YYYY-MM-DD'), endDate: z.string().describe('YYYY-MM-DD, inclusive') })
        .optional()
        .describe(
          'Only with followUpQuestion, for a relative period with none of it fetched: the newest fetched dates of the same length, ' +
            'ending at the newest fetched date. The card offers a button to answer from them instead of fetching.',
        ),
    }),
    execute: async ({ promptId, criteria, followUpQuestion, fallback, ...rest }) => {
      if (promptId !== undefined && criteria) return { error: 'Pass either promptId or criteria, not both.' };
      const question = followUpQuestion?.trim() || undefined;
      const fallbackParsed = fallback ? fetchFallbackSchema.safeParse(fallback) : undefined;
      if (fallbackParsed && !fallbackParsed.success) return { error: fallbackParsed.error.issues.map((i) => i.message).join(' ') };
      let promptTitle: string | undefined;
      let instructions: string | undefined;
      if (promptId !== undefined) {
        const prompt = listPrompts(ownerId, { kind: 'fetch', subjectId: subject.id }).find((p) => p.id === promptId);
        if (!prompt) return { error: 'Those search criteria were not found for this tracker.' };
        promptTitle = prompt.title;
        instructions = prompt.body; // always the rendered text, so the overlap rule matches earlier runs
      }
      const parsed = createFetchRunSchema.safeParse({ ...rest, instructions, criteria });
      if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(' ') };
      const plan = planFetchRun(ownerId, subject.id, parsed.data);
      if (!plan) return { error: 'Tracker not found.' };
      const { startDate, endDate, cadence } = parsed.data;
      return {
        subjectId: subject.id,
        subjectName: subject.name,
        startDate,
        endDate,
        cadence,
        promptId,
        promptTitle,
        // One-time criteria, so the card's Edit mode can show them as fields.
        criteria: criteria ? normalizeCriteria(criteria) : undefined,
        followUpQuestion: question,
        // Already-fetched dates the card offers instead of fetching (meaningless without a question to answer).
        fallback: question && fallbackParsed?.success ? fallbackParsed.data : undefined,
        ...plan,
      };
    },
  });
}
