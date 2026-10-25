import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { createPrompt, listPrompts } from '@/services/promptService';
import { parseCreatePromptRequest, parseListPromptsQuery } from './request';

// ?kind=analyst|fetch and ?subjectId= narrow the list to prompts available on that subject.
export async function GET(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = parseListPromptsQuery(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ prompts: listPrompts(user.id, parsed.data) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = await parseCreatePromptRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = createPrompt(user.id, parsed.data);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ prompt: result.prompt }, { status: 201 });
}
