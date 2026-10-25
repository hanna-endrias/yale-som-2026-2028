import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { listMessages, sendMessage } from '@/services/chatService';
import { parseSendMessageRequest, parseSessionId } from './request';

type Ctx = { params: Promise<{ sessionId: string }> };
const notFound = () => NextResponse.json({ error: 'Chat not found.' }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSessionId(params);
  const messages = id && listMessages(user.id, id);
  return messages ? NextResponse.json({ messages }) : notFound();
}

// Streams the Analyst Agent's reply as an AI SDK UI message stream.
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSessionId(params);
  if (!id) return notFound();
  const parsed = await parseSendMessageRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return sendMessage(user.id, id, parsed.data.text) ?? notFound();
}
