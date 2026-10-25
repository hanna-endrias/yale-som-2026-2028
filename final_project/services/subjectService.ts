import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { chatSessions, subjects } from '@/db/schema';
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
