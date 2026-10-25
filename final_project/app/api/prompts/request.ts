import { createPromptSchema, listPromptsQuerySchema } from '@/lib/validation/prompts';

export function parseListPromptsQuery(req: Request) {
  const params = new URL(req.url).searchParams;
  const result = listPromptsQuerySchema.safeParse({
    kind: params.get('kind') || undefined,
    subjectId: params.get('subjectId') || undefined,
  });
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}

export async function parseCreatePromptRequest(req: Request) {
  const result = createPromptSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
