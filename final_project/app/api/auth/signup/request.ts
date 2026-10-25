import { signupSchema } from '@/lib/validation/auth';

export async function parseSignupRequest(req: Request) {
  const result = signupSchema.safeParse(await req.json().catch(() => null));
  return result.success ? { data: result.data } : { error: result.error.issues[0].message };
}
