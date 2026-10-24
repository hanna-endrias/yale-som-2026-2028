import { pingModel } from '@/lib/healthCheck';

// Scaffold-only health check: GET → one tiny gpt-6-luna call through Portkey.
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await pingModel();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
