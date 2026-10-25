import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { chatMessages, chatSessions, tokenUsage } from '@/db/schema';

// Saves one real chat session (messages, tool rows with chart payloads, per-turn token usage) as a
// seed fixture, so a fresh start shows an example conversation without calling the LLM.
// Usage: npm run fixture:chat -- <sessionId>   (writes db/fixtures/friend-chat.json)

const sessionId = Number(process.argv[2]);
if (!Number.isInteger(sessionId)) {
  console.error('Usage: npm run fixture:chat -- <sessionId>');
  process.exit(1);
}

const db = getDb();
const session = db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).get();
if (!session) {
  console.error(`No chat session ${sessionId}.`);
  process.exit(1);
}

const rows = db
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
  .where(eq(chatMessages.chatSessionId, sessionId))
  .orderBy(asc(chatMessages.id))
  .all();

const messages = rows.map(({ inputTokens, outputTokens, cachedTokens, estimatedCostUsd, ...m }) =>
  inputTokens === null
    ? m
    : { ...m, usage: { inputTokens, outputTokens: outputTokens ?? 0, cachedTokens: cachedTokens ?? 0, estimatedCostUsd: estimatedCostUsd ?? 0 } },
);

const file = path.resolve(process.cwd(), 'db/fixtures/friend-chat.json');
writeFileSync(file, JSON.stringify({ title: session.title, messages }, null, 2) + '\n');
console.log(`Wrote ${file}: "${session.title}", ${messages.length} messages`);
