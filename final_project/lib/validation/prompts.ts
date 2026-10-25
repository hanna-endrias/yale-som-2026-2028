import { z } from 'zod';
import { isEmptyCriteria, searchCriteriaSchema } from '@/lib/searchCriteria';

// 'analyst' = chat question, 'fetch' = search criteria (UI names; DB/API keep the old kinds).
export const promptKindSchema = z.enum(['analyst', 'fetch'], { error: 'Pick a chat question or search criteria.' });
export const PROMPT_KIND_LABEL = { analyst: 'Chat question', fetch: 'Search criteria' } as const;

const fields = {
  kind: promptKindSchema,
  title: z.string().trim().min(1, { error: 'Enter a title.' }).max(80, { error: 'Keep the title to 80 characters.' }),
  // Chat questions only; for search criteria the service renders body from criteria.
  body: z.string().trim().min(1, { error: 'Enter the question.' }).max(2000, { error: 'Keep the question to 2000 characters.' }),
  criteria: searchCriteriaSchema,
  allSubjects: z.boolean({ error: 'allSubjects must be true or false.' }),
  subjectIds: z.array(z.number().int().positive(), { error: 'subjectIds must be a list of tracker ids.' }),
};

const needsSubjects = (v: { allSubjects?: boolean; subjectIds?: number[] }) =>
  v.allSubjects === true || (v.subjectIds?.length ?? 0) > 0;
const needsSubjectsError = { error: 'Pick at least one tracker, or make it available on all trackers.' };
const emptyCriteriaError = 'Fill in at least one search criteria field.';

export const createPromptSchema = z
  .object({
    ...fields,
    body: fields.body.optional(),
    criteria: fields.criteria.optional(),
    allSubjects: fields.allSubjects.default(false),
    subjectIds: fields.subjectIds.default([]),
  })
  .refine(needsSubjects, needsSubjectsError)
  .superRefine((v, ctx) => {
    if (v.kind === 'analyst' && !v.body) ctx.addIssue({ code: 'custom', path: ['body'], message: 'Enter the question.' });
    if (v.kind === 'fetch' && isEmptyCriteria(v.criteria)) ctx.addIssue({ code: 'custom', path: ['criteria'], message: emptyCriteriaError });
  });

// Scope is replaced as a pair, so allSubjects and subjectIds must be sent together.
// Whether body or criteria applies depends on the saved kind, so the service checks that.
export const updatePromptSchema = z
  .object(fields)
  .partial()
  .refine((v) => (v.allSubjects === undefined) === (v.subjectIds === undefined), {
    error: 'Send allSubjects and subjectIds together.',
  })
  .refine((v) => v.allSubjects === undefined || needsSubjects(v), needsSubjectsError)
  .refine((v) => v.criteria === undefined || !isEmptyCriteria(v.criteria), { error: emptyCriteriaError });

export const listPromptsQuerySchema = z.object({
  kind: promptKindSchema.optional(),
  subjectId: z.coerce.number({ error: 'Invalid tracker id.' }).int().positive().optional(),
});

export const promptIdSchema = z.coerce.number().int().positive();

export type PromptKind = z.infer<typeof promptKindSchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
