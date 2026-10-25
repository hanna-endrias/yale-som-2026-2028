import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { deleteSubject, getSubject, updateSubject } from '@/services/subjectService';
import { parseSubjectId, parseUpdateSubjectRequest } from './request';

type Ctx = { params: Promise<{ subjectId: string }> };
const notFound = () => NextResponse.json({ error: 'Tracker not found.' }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  const subject = id && getSubject(user.id, id);
  return subject ? NextResponse.json({ subject }) : notFound();
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  if (!id) return notFound();
  const parsed = await parseUpdateSubjectRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const subject = updateSubject(user.id, id, parsed.data);
  return subject ? NextResponse.json({ subject }) : notFound();
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  return id && deleteSubject(user.id, id) ? NextResponse.json({ ok: true }) : notFound();
}
