import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { createSubject, listSubjects } from '@/services/subjectService';
import { parseCreateSubjectRequest } from './request';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ subjects: listSubjects(user.id) });
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const parsed = await parseCreateSubjectRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ subject: createSubject(user.id, parsed.data) }, { status: 201 });
}
