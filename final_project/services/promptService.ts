import { and, eq, exists, inArray, or } from 'drizzle-orm';
import { DEFAULT_ANALYST_PROMPTS } from '@/agents/prompts/defaults';
import { getDb, type Db } from '@/db/client';
import { promptSubjects, prompts, subjects } from '@/db/schema';
import type { CreatePromptInput, PromptKind, UpdatePromptInput } from '@/lib/validation/prompts';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type PromptItem = {
  id: number;
  kind: PromptKind;
  title: string;
  body: string;
  allSubjects: boolean;
  subjectIds: number[];
  createdAt: string;
};
type PromptResult = { prompt: PromptItem } | { error: string };

const owned = (ownerId: number, id: number) => and(eq(prompts.id, id), eq(prompts.ownerId, ownerId));

// Gives a new user the original analyst starters, available on all subjects.
export function seedDefaultPrompts(tx: Db | Tx, ownerId: number): void {
  tx.insert(prompts)
    .values(DEFAULT_ANALYST_PROMPTS.map((p) => ({ ...p, ownerId, kind: 'analyst' as const, allSubjects: true })))
    .run();
}

// The owner's prompts (oldest first), optionally only one kind and/or those available on a subject.
export function listPrompts(ownerId: number, filter: { kind?: PromptKind; subjectId?: number } = {}): PromptItem[] {
  const db = getDb();
  const { kind, subjectId } = filter;
  const rows = db
    .select()
    .from(prompts)
    .where(
      and(
        eq(prompts.ownerId, ownerId),
        kind ? eq(prompts.kind, kind) : undefined,
        subjectId
          ? or(
              eq(prompts.allSubjects, true),
              exists(
                db
                  .select()
                  .from(promptSubjects)
                  .where(and(eq(promptSubjects.promptId, prompts.id), eq(promptSubjects.subjectId, subjectId))),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(prompts.id)
    .all();
  return withSubjectIds(db, rows);
}

export function createPrompt(ownerId: number, input: CreatePromptInput): PromptResult {
  const subjectIds = scopedSubjectIds(input.allSubjects, input.subjectIds);
  if (!ownsSubjects(ownerId, subjectIds)) return { error: 'One or more subjects were not found.' };
  const { subjectIds: _, ...values } = input;
  const id = getDb().transaction((tx) => {
    const row = tx.insert(prompts).values({ ...values, ownerId }).returning({ id: prompts.id }).get();
    setSubjects(tx, row.id, subjectIds);
    return row.id;
  });
  return { prompt: getPrompt(ownerId, id)! };
}

// null when the prompt isn't the owner's. Scope (allSubjects + subjectIds) is replaced when given.
export function updatePrompt(ownerId: number, id: number, input: UpdatePromptInput): PromptResult | null {
  if (!getPrompt(ownerId, id)) return null;
  const { subjectIds: ids, ...values } = input;
  const subjectIds = input.allSubjects === undefined ? undefined : scopedSubjectIds(input.allSubjects, ids ?? []);
  if (subjectIds && !ownsSubjects(ownerId, subjectIds)) return { error: 'One or more subjects were not found.' };
  getDb().transaction((tx) => {
    if (Object.keys(values).length) tx.update(prompts).set(values).where(owned(ownerId, id)).run();
    if (subjectIds) setSubjects(tx, id, subjectIds);
  });
  return { prompt: getPrompt(ownerId, id)! };
}

export function deletePrompt(ownerId: number, id: number): boolean {
  return getDb().delete(prompts).where(owned(ownerId, id)).run().changes > 0;
}

function getPrompt(ownerId: number, id: number): PromptItem | null {
  const db = getDb();
  const row = db.select().from(prompts).where(owned(ownerId, id)).get();
  return row ? withSubjectIds(db, [row])[0] : null;
}

function withSubjectIds(db: Db, rows: (typeof prompts.$inferSelect)[]): PromptItem[] {
  const links = rows.length
    ? db.select().from(promptSubjects).where(inArray(promptSubjects.promptId, rows.map((r) => r.id))).all()
    : [];
  return rows.map(({ ownerId: _, ...r }) => ({
    ...r,
    subjectIds: links.filter((l) => l.promptId === r.id).map((l) => l.subjectId),
  }));
}

// An all-subjects prompt keeps no per-subject rows.
const scopedSubjectIds = (allSubjects: boolean, ids: number[]) => (allSubjects ? [] : [...new Set(ids)]);

function ownsSubjects(ownerId: number, ids: number[]): boolean {
  if (!ids.length) return true;
  const found = getDb()
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.ownerId, ownerId), inArray(subjects.id, ids)))
    .all();
  return found.length === ids.length;
}

function setSubjects(tx: Tx, promptId: number, subjectIds: number[]): void {
  tx.delete(promptSubjects).where(eq(promptSubjects.promptId, promptId)).run();
  if (subjectIds.length) tx.insert(promptSubjects).values(subjectIds.map((subjectId) => ({ promptId, subjectId }))).run();
}
