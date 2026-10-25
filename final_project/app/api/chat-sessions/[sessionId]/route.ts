import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { deleteChatSession, renameChatSession } from '@/services/chatService';
import { parseRenameSessionRequest, parseSessionId } from './request';

type Ctx = { params: Promise<{ sessionId: string }> };
const notFound = () => NextResponse.json({ error: 'Chat not found.' }, { status: 404 });

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSessionId(params);
  if (!id) return notFound();
  const parsed = await parseRenameSessionRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const session = renameChatSession(user.id, id, parsed.data.title);
  return session ? NextResponse.json({ session }) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSessionId(params);
  return id && deleteChatSession(user.id, id) ? NextResponse.json({ ok: true }) : notFound();
}
