import { z } from 'zod';

const optionalText = z.string().trim().nullish().transform((v) => v || null);

export const createSubjectSchema = z.object({
  name: z.string().trim().min(1, { error: 'Enter a name.' }),
  description: z.string().trim().default(''),
  location: optionalText,
  website: optionalText,
  searchTerms: z.string().trim().default(''),
});

export const updateSubjectSchema = createSubjectSchema.partial();

export const subjectIdSchema = z.coerce.number().int().positive();

export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectSchema>;
