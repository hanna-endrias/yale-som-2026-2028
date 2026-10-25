import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { recordFetchPlanStart } from '@/services/chatService';
import { parseFetchPlanStartRequest, parseSessionId } from './request';

type Ctx = { params: Promise<{ sessionId: string }> };
const notFound = () => NextResponse.json({ error: 'Fetch plan not found.' }, { status: 404 });

// A fetch plan card records the runs it started on its own chat message, so a reload shows them.
export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSessionId(params);
  if (!id) return notFound();
  const parsed = await parseFetchPlanStartRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const started = recordFetchPlanStart(user.id, id, parsed.data);
  return started ? NextResponse.json({ started }) : notFound();
}
