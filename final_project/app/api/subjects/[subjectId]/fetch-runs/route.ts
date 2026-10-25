import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { listFetchRuns, startFetchRun } from '@/services/fetchRunService';
import { getSubject } from '@/services/subjectService';
import { parseCreateFetchRunRequest, parseSubjectId } from './request';

type Ctx = { params: Promise<{ subjectId: string }> };
const notFound = () => NextResponse.json({ error: 'Subject not found.' }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  const runs = id && listFetchRuns(user.id, id);
  return runs ? NextResponse.json({ runs }) : notFound();
}

// Returns right away with the pending run; the fetch itself runs in the background.
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  if (!id || !getSubject(user.id, id)) return notFound();
  const parsed = await parseCreateFetchRunRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const run = startFetchRun(user.id, id, parsed.data);
  return run ? NextResponse.json({ run }, { status: 201 }) : notFound();
}
