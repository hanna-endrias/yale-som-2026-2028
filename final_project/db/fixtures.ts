import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { and, asc, eq, inArray, notExists } from 'drizzle-orm';
import type { Db } from './client';
import { chatMessages, chatSessions, fetchRuns, mentions, promptSubjects, prompts, subjects, tokenUsage, users } from './schema';

// Seed data: one JSON file per subject in db/fixtures/subjects/, saved from the live DB by
// `npm run fixture:save` and loaded on every fresh start by db/seed.ts. All real fetched data, so a
// reset brings it back without spending tokens. `npm run fixture:remove` deletes a file and its subject.

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Usage = { inputTokens: number; outputTokens: number; cachedTokens: number; estimatedCostUsd: number };

export type SubjectFixture = {
  savedAt: string;
  owner: string; // email of the owning test user
  subject: { name: string; description: string; location: string | null; website: string | null; searchTerms: string };
  prompts: { kind: 'analyst' | 'fetch'; title: string; body: string }[]; // library prompts scoped to this subject
  runs: {
    startDate: string;
    endDate: string;
    cadence: string;
    instructions: string | null;
    usage: Usage[]; // one row per fetched window, as a live run logs them
    mentions: Omit<typeof mentions.$inferInsert, 'id' | 'subjectId' | 'fetchRunId'>[];
  }[];
  chats: {
    title: string | null;
    messages: { role: 'user' | 'assistant' | 'tool'; content: string; payload: string | null; usage?: Usage }[];
  }[];
};

export const FIXTURES_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'db/fixtures/subjects');

export const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// Slugs of the saved fixtures, alphabetical (the seed order).
export function listFixtures(): string[] {
  try {
    return readdirSync(FIXTURES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
      .sort();
  } catch {
    return [];
  }
}

export const fixturePath = (slug: string) => path.join(FIXTURES_DIR, `${slug}.json`);

export function readFixture(slug: string): SubjectFixture {
  return JSON.parse(readFileSync(fixturePath(slug), 'utf8'));
}

// Builds a fixture from a subject in the live DB: finished runs with their mentions and token rows,
// prompts scoped to it, and every chat with its per-turn token usage. Pending/failed runs are skipped.
export function exportSubject(db: Db, subjectId: number): { fixture: SubjectFixture; skippedRuns: number } | null {
  const row = db
    .select({ subject: subjects, owner: users.email })
    .from(subjects)
    .innerJoin(users, eq(users.id, subjects.ownerId))
    .where(eq(subjects.id, subjectId))
    .get();
  if (!row) return null;
  const { name, description, location, website, searchTerms } = row.subject;

  const allRuns = db.select().from(fetchRuns).where(eq(fetchRuns.subjectId, subjectId)).orderBy(asc(fetchRuns.id)).all();
  const runs = allRuns
    .filter((r) => r.status === 'done')
    .map((r) => ({
      startDate: r.startDate,
      endDate: r.endDate,
      cadence: r.cadence,
      instructions: r.instructions,
      usage: db
        .select({
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          cachedTokens: tokenUsage.cachedTokens,
          estimatedCostUsd: tokenUsage.estimatedCostUsd,
        })
        .from(tokenUsage)
        .where(and(eq(tokenUsage.scope, 'fetch_run'), eq(tokenUsage.refId, r.id)))
        .orderBy(asc(tokenUsage.id))
        .all(),
      mentions: db
        .select()
        .from(mentions)
        .where(eq(mentions.fetchRunId, r.id))
        .orderBy(asc(mentions.id))
        .all()
        .map(({ id: _id, subjectId: _s, fetchRunId: _r, ...m }) => m),
    }));

  const scopedPrompts = db
    .select({ kind: prompts.kind, title: prompts.title, body: prompts.body })
    .from(prompts)
    .innerJoin(promptSubjects, eq(promptSubjects.promptId, prompts.id))
    .where(and(eq(promptSubjects.subjectId, subjectId), eq(prompts.allSubjects, false)))
    .orderBy(asc(prompts.id))
    .all();

  const sessions = db.select().from(chatSessions).where(eq(chatSessions.subjectId, subjectId)).orderBy(asc(chatSessions.id)).all();
  const chats = sessions.map((s) => ({
    title: s.title,
    messages: db
      .select({
        role: chatMessages.role,
        content: chatMessages.content,
        payload: chatMessages.payload,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        cachedTokens: tokenUsage.cachedTokens,
        estimatedCostUsd: tokenUsage.estimatedCostUsd,
      })
      .from(chatMessages)
      .leftJoin(tokenUsage, and(eq(tokenUsage.scope, 'chat_turn'), eq(tokenUsage.refId, chatMessages.id)))
      .where(eq(chatMessages.chatSessionId, s.id))
      .orderBy(asc(chatMessages.id))
      .all()
      .map(({ inputTokens, outputTokens, cachedTokens, estimatedCostUsd, ...m }) =>
        inputTokens === null
          ? m
          : { ...m, usage: { inputTokens, outputTokens: outputTokens ?? 0, cachedTokens: cachedTokens ?? 0, estimatedCostUsd: estimatedCostUsd ?? 0 } },
      ),
  }));

  return {
    fixture: {
      savedAt: new Date().toISOString(),
      owner: row.owner,
      subject: { name, description, location, website, searchTerms },
      prompts: scopedPrompts,
      runs,
      chats,
    },
    skippedRuns: allRuns.length - runs.length,
  };
}

// Inserts one fixture under ownerId (inside the seed transaction).
export function insertSubject(tx: Tx, ownerId: number, f: SubjectFixture): void {
  const subject = tx
    .insert(subjects)
    .values({ ownerId, ...f.subject })
    .returning()
    .get();

  for (const p of f.prompts) {
    const prompt = tx.insert(prompts).values({ ownerId, ...p }).returning().get();
    tx.insert(promptSubjects).values({ promptId: prompt.id, subjectId: subject.id }).run();
  }

  for (const { usage, mentions: found, ...r } of f.runs) {
    const run = tx
      .insert(fetchRuns)
      .values({ subjectId: subject.id, ...r, status: 'done' })
      .returning()
      .get();
    if (found.length) {
      tx.insert(mentions)
        .values(found.map((m) => ({ ...m, subjectId: subject.id, fetchRunId: run.id })))
        .run();
    }
    for (const u of usage) tx.insert(tokenUsage).values({ scope: 'fetch_run', refId: run.id, ...u }).run();
  }

  // Per-turn token usage keeps ref_id = the new assistant message id, so cost badges show after reload.
  for (const chat of f.chats) {
    const session = tx.insert(chatSessions).values({ subjectId: subject.id, ownerId, title: chat.title }).returning().get();
    for (const { usage, ...m } of chat.messages) {
      const row = tx.insert(chatMessages).values({ ...m, chatSessionId: session.id }).returning().get();
      if (usage) tx.insert(tokenUsage).values({ scope: 'chat_turn', refId: row.id, ...usage }).run();
    }
  }
}

// Deletes the owner's subjects with this name from the live DB, plus what cascades miss: token_usage
// rows (ref_id has no FK) and library prompts that were scoped only to them. Returns subjects deleted.
export function removeSubject(db: Db, ownerEmail: string, name: string): number {
  return db.transaction((tx) => {
    const found = tx
      .select({ id: subjects.id })
      .from(subjects)
      .innerJoin(users, eq(users.id, subjects.ownerId))
      .where(and(eq(users.email, ownerEmail), eq(subjects.name, name)))
      .all()
      .map((s) => s.id);
    if (!found.length) return 0;

    const runIds = tx.select({ id: fetchRuns.id }).from(fetchRuns).where(inArray(fetchRuns.subjectId, found)).all().map((r) => r.id);
    const messageIds = tx
      .select({ id: chatMessages.id })
      .from(chatMessages)
      .innerJoin(chatSessions, eq(chatSessions.id, chatMessages.chatSessionId))
      .where(inArray(chatSessions.subjectId, found))
      .all()
      .map((m) => m.id);
    const promptIds = tx
      .select({ id: promptSubjects.promptId })
      .from(promptSubjects)
      .where(inArray(promptSubjects.subjectId, found))
      .all()
      .map((p) => p.id);

    if (runIds.length) tx.delete(tokenUsage).where(and(eq(tokenUsage.scope, 'fetch_run'), inArray(tokenUsage.refId, runIds))).run();
    if (messageIds.length) tx.delete(tokenUsage).where(and(eq(tokenUsage.scope, 'chat_turn'), inArray(tokenUsage.refId, messageIds))).run();
    tx.delete(subjects).where(inArray(subjects.id, found)).run(); // cascades runs, mentions, chats, prompt links
    if (promptIds.length) {
      tx.delete(prompts)
        .where(
          and(
            inArray(prompts.id, promptIds),
            eq(prompts.allSubjects, false),
            notExists(tx.select().from(promptSubjects).where(eq(promptSubjects.promptId, prompts.id))),
          ),
        )
        .run();
    }
    return found.length;
  });
}
