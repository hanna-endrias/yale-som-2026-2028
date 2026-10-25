import { z } from 'zod';
import { splitWindows } from '@/agents/cadenceWrapper';
import { MAX_FETCH_WINDOWS } from '@/lib/safety';

const date = z.iso.date({ error: 'Enter dates as YYYY-MM-DD.' });

export const createFetchRunSchema = z
  .object({
    startDate: date,
    endDate: date,
    cadence: z.enum(['daily', 'weekly', 'monthly'], { error: 'Pick a daily, weekly or monthly cadence.' }),
    // Optional owner focus for this run; blank means base prompt only.
    instructions: z
      .string({ error: 'instructions must be text.' })
      .trim()
      .max(2000, { error: 'Keep the prompt to 2000 characters.' })
      .optional()
      .transform((v) => v || undefined),
  })
  .superRefine((v, ctx) => {
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
  });

export type CreateFetchRunInput = z.infer<typeof createFetchRunSchema>;
