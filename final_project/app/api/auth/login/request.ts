import { loginSchema } from '@/lib/validation/auth';

export async function parseLoginRequest(req: Request) {
  const result = loginSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
