import { tool } from 'ai';
import { z } from 'zod';
import { createFetchRunSchema } from '@/lib/validation/fetchRuns';
import { planFetchRun } from '@/services/fetchRunService';
import { listPrompts } from '@/services/promptService';

export const PLAN_FETCH_TOOL = 'planFetchRun';

// Plans a fetch (gaps not yet covered with the same prompt) and shows it as a card with a Start button.
// Never starts anything: only the owner's click on the card does. Owner and subject are fixed server-side.
export function planFetchRunTool(ownerId: number, subject: { id: number; name: string }) {
  return tool({
    description:
      'Plan a fetch of new mentions for this subject once the user has given start date, end date, cadence and a fetch prompt choice. ' +
      'Shows the user a plan card with a Start button; it does NOT start the fetch. Pass promptId (a library fetch prompt), ' +
      'or instructions (new prompt text), or neither (no prompt).',
    inputSchema: z.object({
      startDate: z.string().describe('YYYY-MM-DD'),
      endDate: z.string().describe('YYYY-MM-DD, inclusive'),
      cadence: z.enum(['daily', 'weekly', 'monthly']),
      promptId: z.number().int().optional().describe('Id of a library fetch prompt'),
      instructions: z.string().optional().describe('New one-time fetch prompt text'),
    }),
    execute: async ({ promptId, instructions, ...rest }) => {
      if (promptId !== undefined && instructions?.trim()) return { error: 'Pass either promptId or instructions, not both.' };
      let promptTitle: string | undefined;
      if (promptId !== undefined) {
        const prompt = listPrompts(ownerId, { kind: 'fetch', subjectId: subject.id }).find((p) => p.id === promptId);
        if (!prompt) return { error: 'That fetch prompt was not found for this subject.' };
        promptTitle = prompt.title;
        instructions = prompt.body;
      }
      const parsed = createFetchRunSchema.safeParse({ ...rest, instructions });
      if (!parsed.success) return { error: parsed.error.issues.map((i) => i.message).join(' ') };
      const plan = planFetchRun(ownerId, subject.id, parsed.data);
      if (!plan) return { error: 'Subject not found.' };
      const { startDate, endDate, cadence } = parsed.data;
      return { subjectId: subject.id, subjectName: subject.name, startDate, endDate, cadence, promptTitle, ...plan };
    },
  });
}
