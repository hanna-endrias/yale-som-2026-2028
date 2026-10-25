import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { createChatSession } from '@/services/chatService';
import { parseSubjectId } from './request';

type Ctx = { params: Promise<{ subjectId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  const session = id && createChatSession(user.id, id);
  return session
    ? NextResponse.json({ session }, { status: 201 })
    : NextResponse.json({ error: 'Tracker not found.' }, { status: 404 });
}
