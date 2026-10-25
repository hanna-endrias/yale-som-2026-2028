import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { deletePrompt, updatePrompt } from '@/services/promptService';
import { parsePromptId, parseUpdatePromptRequest } from './request';

type Ctx = { params: Promise<{ promptId: string }> };
const notFound = () => NextResponse.json({ error: 'Prompt not found.' }, { status: 404 });

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parsePromptId(params);
  if (!id) return notFound();
  const parsed = await parseUpdatePromptRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = updatePrompt(user.id, id, parsed.data);
  if (!result) return notFound();
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ prompt: result.prompt });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parsePromptId(params);
  return id && deletePrompt(user.id, id) ? NextResponse.json({ ok: true }) : notFound();
}
