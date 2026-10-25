import { createSubjectSchema } from '@/lib/validation/subjects';

export async function parseCreateSubjectRequest(req: Request) {
  const result = createSubjectSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
