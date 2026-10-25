import { and, count, desc, eq, max, min, sum } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { chatMessages, chatSessions, fetchRuns, mentions, subjects, tokenUsage } from '@/db/schema';
import type { CreateSubjectInput, UpdateSubjectInput } from '@/lib/validation/subjects';

// Every query is scoped to ownerId, so another owner's subject is simply "not found".
const owned = (ownerId: number, id: number) => and(eq(subjects.id, id), eq(subjects.ownerId, ownerId));

export type SidebarSubject = {
  id: number;
  name: string;
  sessions: { id: number; title: string | null; createdAt: string }[];
};

// Subjects with their chat sessions (newest first): everything the sidebar needs.
export function listSubjects(ownerId: number): SidebarSubject[] {
  const db = getDb();
  const rows = db
    .select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.ownerId, ownerId))
    .orderBy(subjects.name)
    .all();
  const sessions = db
    .select({ id: chatSessions.id, subjectId: chatSessions.subjectId, title: chatSessions.title, createdAt: chatSessions.createdAt })
    .from(chatSessions)
    .where(eq(chatSessions.ownerId, ownerId))
    .orderBy(desc(chatSessions.createdAt), desc(chatSessions.id))
    .all();
  return rows.map((s) => ({
    ...s,
    sessions: sessions.filter((c) => c.subjectId === s.id).map(({ subjectId: _, ...c }) => c),
  }));
}

export type TrackerOverview = {
  id: number;
  name: string;
  latestSessionId: number | null;
  sentiment: { positive: number; neutral: number; negative: number };
  fetched: { start: string; end: string } | null; // earliest start / latest end of done runs
  costUsd: number; // estimated, over every fetch window and chat turn
};

// Per-tracker stats for the /chat home cards, from stored data only (no LLM call).
export function listTrackerOverviews(ownerId: number): TrackerOverview[] {
  const db = getDb();
  const ownedSubject = eq(subjects.ownerId, ownerId);
  const counts = db
    .select({ subjectId: mentions.subjectId, sentiment: mentions.sentiment, n: count() })
    .from(mentions)
    .innerJoin(subjects, eq(mentions.subjectId, subjects.id))
    .where(ownedSubject)
    .groupBy(mentions.subjectId, mentions.sentiment)
    .all();
  const ranges = db
    .select({ subjectId: fetchRuns.subjectId, start: min(fetchRuns.startDate), end: max(fetchRuns.endDate) })
    .from(fetchRuns)
    .innerJoin(subjects, eq(fetchRuns.subjectId, subjects.id))
    .where(and(ownedSubject, eq(fetchRuns.status, 'done')))
    .groupBy(fetchRuns.subjectId)
    .all();
  const fetchCost = db
    .select({ subjectId: fetchRuns.subjectId, usd: sum(tokenUsage.estimatedCostUsd) })
    .from(tokenUsage)
    .innerJoin(fetchRuns, and(eq(tokenUsage.scope, 'fetch_run'), eq(tokenUsage.refId, fetchRuns.id)))
    .innerJoin(subjects, eq(fetchRuns.subjectId, subjects.id))
    .where(ownedSubject)
    .groupBy(fetchRuns.subjectId)
    .all();
  const chatCost = db
    .select({ subjectId: chatSessions.subjectId, usd: sum(tokenUsage.estimatedCostUsd) })
    .from(tokenUsage)
    .innerJoin(chatMessages, and(eq(tokenUsage.scope, 'chat_turn'), eq(tokenUsage.refId, chatMessages.id)))
    .innerJoin(chatSessions, eq(chatMessages.chatSessionId, chatSessions.id))
    .where(eq(chatSessions.ownerId, ownerId))
    .groupBy(chatSessions.subjectId)
    .all();

  const costOf = (rows: { subjectId: number; usd: string | null }[], id: number) =>
    Number(rows.find((r) => r.subjectId === id)?.usd ?? 0);
  return listSubjects(ownerId).map((s) => {
    const sentiment = { positive: 0, neutral: 0, negative: 0 };
    for (const c of counts) if (c.subjectId === s.id) sentiment[c.sentiment] = c.n;
    const range = ranges.find((r) => r.subjectId === s.id);
    return {
      id: s.id,
      name: s.name,
      latestSessionId: s.sessions[0]?.id ?? null,
      sentiment,
      fetched: range?.start && range.end ? { start: range.start, end: range.end } : null,
      costUsd: costOf(fetchCost, s.id) + costOf(chatCost, s.id),
    };
  });
}

export function getSubject(ownerId: number, id: number) {
  return getDb().select().from(subjects).where(owned(ownerId, id)).get() ?? null;
}

export function createSubject(ownerId: number, input: CreateSubjectInput) {
  return getDb().insert(subjects).values({ ...input, ownerId }).returning().get();
}

export function updateSubject(ownerId: number, id: number, input: UpdateSubjectInput) {
  if (Object.keys(input).length === 0) return getSubject(ownerId, id);
  return getDb().update(subjects).set(input).where(owned(ownerId, id)).returning().get() ?? null;
}

export function deleteSubject(ownerId: number, id: number): boolean {
  return getDb().delete(subjects).where(owned(ownerId, id)).run().changes > 0;
}
