import { subjectIdSchema, updateSubjectSchema } from '@/lib/validation/subjects';

// A malformed id is treated like a missing one (null -> 404).
export async function parseSubjectId(params: Promise<{ subjectId: string }>) {
  const result = subjectIdSchema.safeParse((await params).subjectId);
  return result.success ? result.data : null;
}

export async function parseUpdateSubjectRequest(req: Request) {
  const result = updateSubjectSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
