import { fetchPlanStartSchema } from '@/lib/validation/chat';

export { parseSessionId } from '../request';

export async function parseFetchPlanStartRequest(req: Request) {
  const result = fetchPlanStartSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
