import { promptIdSchema, updatePromptSchema } from '@/lib/validation/prompts';

// A malformed id is treated like a missing one (null -> 404).
export async function parsePromptId(params: Promise<{ promptId: string }>) {
  const result = promptIdSchema.safeParse((await params).promptId);
  return result.success ? result.data : null;
}

export async function parseUpdatePromptRequest(req: Request) {
  const result = updatePromptSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
