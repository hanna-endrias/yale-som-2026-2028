import { createFetchRunSchema } from '@/lib/validation/fetchRuns';

export { parseSubjectId } from '../request';

export async function parseCreateFetchRunRequest(req: Request) {
  const result = createFetchRunSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
