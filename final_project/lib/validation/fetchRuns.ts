import { z } from 'zod';
import { splitWindows } from '@/agents/cadenceWrapper';
import { criteriaToInstructions, searchCriteriaSchema } from '@/lib/searchCriteria';
import { MAX_FETCH_WINDOWS } from '@/lib/safety';

const date = z.iso.date({ error: 'Enter dates as YYYY-MM-DD.' });

// Optional owner focus for the run: structured `criteria` or raw `instructions` text (at most one).
// The output always carries the rendered `instructions` only (blank -> undefined = base prompt only).
export const createFetchRunSchema = z
  .object({
    startDate: date,
    endDate: date,
    cadence: z.enum(['daily', 'weekly', 'monthly'], { error: 'Pick a daily, weekly or monthly cadence.' }),
    instructions: z
      .string({ error: 'instructions must be text.' })
      .trim()
      .max(2000, { error: 'Keep the search criteria to 2000 characters.' })
      .optional(),
    criteria: searchCriteriaSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.instructions && v.criteria) {
      ctx.addIssue({ code: 'custom', message: 'Send either criteria or instructions, not both.' });
      return;
    }
    if (v.startDate > v.endDate) {
      ctx.addIssue({ code: 'custom', message: 'The start date must be on or before the end date.' });
      return;
    }
    const n = splitWindows(v.startDate, v.endDate, v.cadence).length;
    if (n > MAX_FETCH_WINDOWS) {
      ctx.addIssue({
        code: 'custom',
        message: `That range makes ${n} ${v.cadence} windows; the limit is ${MAX_FETCH_WINDOWS}. Shorten the range or pick a longer cadence.`,
      });
    }
  })
  .transform(({ criteria, instructions, ...v }) => ({
    ...v,
    instructions: (criteria ? criteriaToInstructions(criteria) : instructions) || undefined,
  }));

export type CreateFetchRunInput = z.output<typeof createFetchRunSchema>;
