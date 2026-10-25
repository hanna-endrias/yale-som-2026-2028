import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/session';
import { listFetchRuns, startFetchRun } from '@/services/fetchRunService';
import { getSubject } from '@/services/subjectService';
import { parseCreateFetchRunRequest, parseSubjectId } from './request';

type Ctx = { params: Promise<{ subjectId: string }> };
const notFound = () => NextResponse.json({ error: 'Tracker not found.' }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  const runs = id && listFetchRuns(user.id, id);
  return runs ? NextResponse.json({ runs }) : notFound();
}

// Returns right away with one pending run per uncovered gap; the fetches run in the background.
// 409 when every requested date is already fetched with the same search criteria.
export async function POST(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const id = await parseSubjectId(params);
  if (!id || !getSubject(user.id, id)) return notFound();
  const parsed = await parseCreateFetchRunRequest(req);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const result = startFetchRun(user.id, id, parsed.data);
  if (!result) return notFound();
  if ('covered' in result) {
    return NextResponse.json(
      { error: 'Those dates are already fetched with these search criteria.', skipped: result.covered },
      { status: 409 },
    );
  }
  return NextResponse.json(result, { status: 201 });
}
