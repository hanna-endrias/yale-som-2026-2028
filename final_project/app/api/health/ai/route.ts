import { pingModel } from '@/lib/healthCheck';

// Scaffold-only health check: GET → one tiny call to the active LLM provider (config/llm.ts).
export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await pingModel();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
