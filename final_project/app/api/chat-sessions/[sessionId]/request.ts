import { renameSessionSchema, sessionIdSchema } from '@/lib/validation/chat';

// A malformed id is treated like a missing one (null -> 404).
export async function parseSessionId(params: Promise<{ sessionId: string }>) {
  const result = sessionIdSchema.safeParse((await params).sessionId);
  return result.success ? result.data : null;
}

export async function parseRenameSessionRequest(req: Request) {
  const result = renameSessionSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
