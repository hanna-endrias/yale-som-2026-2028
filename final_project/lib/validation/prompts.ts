import { z } from 'zod';

export const promptKindSchema = z.enum(['analyst', 'fetch'], { error: 'Pick an analyst or fetcher prompt.' });

const fields = {
  kind: promptKindSchema,
  title: z.string().trim().min(1, { error: 'Enter a title.' }).max(80, { error: 'Keep the title to 80 characters.' }),
  body: z.string().trim().min(1, { error: 'Enter the prompt.' }).max(2000, { error: 'Keep the prompt to 2000 characters.' }),
  allSubjects: z.boolean({ error: 'allSubjects must be true or false.' }),
  subjectIds: z.array(z.number().int().positive(), { error: 'subjectIds must be a list of subject ids.' }),
};

const needsSubjects = (v: { allSubjects?: boolean; subjectIds?: number[] }) =>
  v.allSubjects === true || (v.subjectIds?.length ?? 0) > 0;
const needsSubjectsError = { error: 'Pick at least one subject, or make it available on all subjects.' };

export const createPromptSchema = z
  .object({ ...fields, allSubjects: fields.allSubjects.default(false), subjectIds: fields.subjectIds.default([]) })
  .refine(needsSubjects, needsSubjectsError);

// Scope is replaced as a pair, so allSubjects and subjectIds must be sent together.
export const updatePromptSchema = z
  .object(fields)
  .partial()
  .refine((v) => (v.allSubjects === undefined) === (v.subjectIds === undefined), {
    error: 'Send allSubjects and subjectIds together.',
  })
  .refine((v) => v.allSubjects === undefined || needsSubjects(v), needsSubjectsError);

export const listPromptsQuerySchema = z.object({
  kind: promptKindSchema.optional(),
  subjectId: z.coerce.number({ error: 'Invalid subject id.' }).int().positive().optional(),
});

export const promptIdSchema = z.coerce.number().int().positive();

export type PromptKind = z.infer<typeof promptKindSchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
