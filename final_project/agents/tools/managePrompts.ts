import { tool } from 'ai';
import { z } from 'zod';
import { criteriaToInstructions, searchCriteriaSchema } from '@/lib/searchCriteria';
import { createPromptSchema, promptKindSchema, updatePromptSchema } from '@/lib/validation/prompts';
import { createPrompt, listPrompts, type PromptItem } from '@/services/promptService';

export const UPDATE_PROMPT_TOOL = 'updatePrompt';
export const DELETE_PROMPT_TOOL = 'deletePrompt';

type Subject = { id: number; name: string };

const BODY_PREVIEW = 300;
const preview = (body: string) => (body.length > BODY_PREVIEW ? `${body.slice(0, BODY_PREVIEW)}…` : body);
const zodError = (e: z.ZodError) => ({ error: e.issues.map((i) => i.message).join(' ') });
const findPrompt = (ownerId: number, id: number) => listPrompts(ownerId).find((p) => p.id === id);
const notFound = { error: 'Prompt not found.' };

// Prompt-library tools for the analyst chat. Owner and subject are fixed server-side; any prompt id the model
// passes is looked up among the owner's prompts only. Update and delete never write: they return a card payload
// the owner must confirm with a click (which calls PATCH/DELETE /api/prompts/:id).
export function managePromptTools(ownerId: number, subject: Subject) {
  return {
    listPrompts: tool({
      description:
        "List the owner's library prompts. kind 'fetch' = saved search criteria (steer web searches; body is the rendered criteria), " +
        "'analyst' = chat questions. scope 'subject' (default) = prompts available on this tracker; 'all' = every prompt the owner has.",
      inputSchema: z.object({
        kind: promptKindSchema.optional(),
        scope: z.enum(['subject', 'all']).default('subject'),
      }),
      execute: async ({ kind, scope }) =>
        listPrompts(ownerId, { kind, subjectId: scope === 'subject' ? subject.id : undefined }).map((p) => ({
          id: p.id,
          kind: p.kind,
          title: p.title,
          body: preview(p.body),
          allSubjects: p.allSubjects,
        })),
    }),

    createPrompt: tool({
      description:
        `Save a new library prompt. Scoped to "${subject.name}" unless allSubjects is true (only when the user asks for all trackers). ` +
        "kind 'analyst' (chat question) needs body; kind 'fetch' (search criteria) needs criteria instead of body.",
      inputSchema: z.object({
        kind: promptKindSchema,
        title: z.string(),
        body: z.string().optional().describe('The question (kind analyst only)'),
        criteria: searchCriteriaSchema
          .optional()
          .describe('kind fetch only: sources, topics, excludeKeywords, region, language, notes (all optional, at least one)'),
        allSubjects: z.boolean().optional(),
      }),
      execute: async ({ allSubjects, ...rest }) => {
        const parsed = createPromptSchema.safeParse({
          ...rest,
          allSubjects: !!allSubjects,
          subjectIds: allSubjects ? [] : [subject.id],
        });
        if (!parsed.success) return zodError(parsed.error);
        const result = createPrompt(ownerId, parsed.data);
        if ('error' in result) return result;
        const p = result.prompt;
        return { id: p.id, kind: p.kind, title: p.title, body: preview(p.body), allSubjects: p.allSubjects };
      },
    }),

    [UPDATE_PROMPT_TOOL]: tool({
      description:
        'Propose a change to a library prompt (find its id with listPrompts first). Does NOT save: the user sees a ' +
        "before/after card and must click Save. scope 'subject' = only this tracker, 'all' = all trackers. " +
        'Change a chat question with body, and search criteria with criteria (the full new criteria).',
      inputSchema: z.object({
        id: z.number().int(),
        title: z.string().optional(),
        body: z.string().optional().describe('New question (chat questions only)'),
        criteria: searchCriteriaSchema.optional().describe('New search criteria (search criteria only)'),
        kind: promptKindSchema.optional(),
        scope: z.enum(['subject', 'all']).optional(),
      }),
      execute: async ({ id, scope, ...fields }) => {
        const before = findPrompt(ownerId, id);
        if (!before) return notFound;
        const kind = fields.kind ?? before.kind;
        if (kind === 'fetch' && fields.body !== undefined) return { error: 'Search criteria are changed with criteria, not body.' };
        if (kind === 'analyst' && fields.criteria !== undefined) return { error: 'Chat questions are changed with body, not criteria.' };
        const parsed = updatePromptSchema.safeParse({
          ...fields,
          ...(scope && { allSubjects: scope === 'all', subjectIds: scope === 'all' ? [] : [subject.id] }),
        });
        if (!parsed.success) return zodError(parsed.error);
        const patch = changedFields(before, parsed.data);
        if (!Object.keys(patch).length) return { error: 'That would not change anything.' };
        return {
          id,
          subjectId: subject.id,
          subjectName: subject.name,
          before: {
            kind: before.kind,
            title: before.title,
            body: before.body,
            allSubjects: before.allSubjects,
            subjectIds: before.subjectIds,
          },
          patch,
        };
      },
    }),

    [DELETE_PROMPT_TOOL]: tool({
      description:
        'Ask to delete a library prompt (find its id with listPrompts first). Does NOT delete: the user sees a confirm card and must click Delete.',
      inputSchema: z.object({ id: z.number().int() }),
      execute: async ({ id }) => {
        const p = findPrompt(ownerId, id);
        if (!p) return notFound;
        return { id: p.id, kind: p.kind, title: p.title, body: preview(p.body) };
      },
    }),
  };
}

// Only the fields that differ from the current prompt (scope is kept as the allSubjects + subjectIds pair).
function changedFields(before: PromptItem, input: z.infer<typeof updatePromptSchema>) {
  const patch: z.infer<typeof updatePromptSchema> = {};
  if (input.kind !== undefined && input.kind !== before.kind) patch.kind = input.kind;
  if (input.title !== undefined && input.title !== before.title) patch.title = input.title;
  if (input.body !== undefined && input.body !== before.body) patch.body = input.body;
  if (input.criteria !== undefined && criteriaToInstructions(input.criteria) !== before.body) patch.criteria = input.criteria;
  if (input.allSubjects !== undefined) {
    const sameIds =
      [...input.subjectIds!].sort().join() === [...before.subjectIds].sort().join();
    if (input.allSubjects !== before.allSubjects || (!input.allSubjects && !sameIds)) {
      patch.allSubjects = input.allSubjects;
      patch.subjectIds = input.subjectIds;
    }
  }
  return patch;
}
