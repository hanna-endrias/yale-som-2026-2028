import { readFileSync } from 'node:fs';
import path from 'node:path';
import { hashPassword } from '@/lib/auth';
import { estimateCost } from '@/lib/cost';
import { seedDefaultPrompts } from '@/services/promptService';
import type { Db } from './client';
import { chatMessages, chatSessions, fetchRuns, mentions, promptSubjects, prompts, subjects, tokenUsage, users } from './schema';

// A real fetch run captured once by `npm run fixture:capture` (scripts/capture-fixture.ts), so a fresh
// start has real mentions and real token counts without calling the LLM.
type Fixture = {
  subject: { name: string; description: string; location: string | null; website: string | null; searchTerms: string };
  run: { startDate: string; endDate: string; cadence: string; instructions: string };
  windows: {
    usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
    mentions: Omit<typeof mentions.$inferInsert, 'subjectId' | 'fetchRunId'>[];
  }[];
};

// A real chat on that data, exported by `npm run fixture:chat` (scripts/export-chat-fixture.ts),
// so a new user can see what can be asked: tables, citations and charts.
type ChatFixture = {
  title: string;
  messages: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    payload: string | null;
    usage?: { inputTokens: number; outputTokens: number; cachedTokens: number; estimatedCostUsd: number };
  }[];
};

function loadFixture<T>(name: string): T {
  const file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'db/fixtures', `${name}.json`);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function seed(db: Db): void {
  const friend = loadFixture<Fixture>('friend');
  const chat = loadFixture<ChatFixture>('friend-chat');
  db.transaction((tx) => {
    const owner1 = tx.insert(users).values({ email: 'owner1@test.com', passwordHash: hashPassword('test1234') }).returning().get();
    const owner2 = tx.insert(users).values({ email: 'owner2@test.com', passwordHash: hashPassword('test1234') }).returning().get();
    seedDefaultPrompts(tx, owner1.id);
    seedDefaultPrompts(tx, owner2.id);

    const subject = tx
      .insert(subjects)
      .values({ ownerId: owner1.id, ...friend.subject })
      .returning()
      .get();

    // The focus prompt the fixture run used, saved in the library and scoped to the subject.
    const focus = tx
      .insert(prompts)
      .values({ ownerId: owner1.id, kind: 'fetch', title: 'Whole conversation, incl. the ad campaign', body: friend.run.instructions })
      .returning()
      .get();
    tx.insert(promptSubjects).values({ promptId: focus.id, subjectId: subject.id }).run();

    const run = tx
      .insert(fetchRuns)
      .values({ subjectId: subject.id, ...friend.run, status: 'done' })
      .returning()
      .get();

    for (const w of friend.windows) {
      if (w.mentions.length) {
        tx.insert(mentions)
          .values(w.mentions.map((m) => ({ ...m, subjectId: subject.id, fetchRunId: run.id })))
          .run();
      }
      // One row per window, as a live run logs them.
      tx.insert(tokenUsage)
        .values({ scope: 'fetch_run', refId: run.id, ...w.usage, estimatedCostUsd: estimateCost(w.usage) })
        .run();
    }

    // The example chat, with its real per-turn token usage (ref_id = the new assistant message id).
    const session = tx.insert(chatSessions).values({ subjectId: subject.id, ownerId: owner1.id, title: chat.title }).returning().get();
    for (const { usage, ...m } of chat.messages) {
      const row = tx.insert(chatMessages).values({ ...m, chatSessionId: session.id }).returning().get();
      if (usage) tx.insert(tokenUsage).values({ scope: 'chat_turn', refId: row.id, ...usage }).run();
    }
  });
}
