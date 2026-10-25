import type { ModelMessage, UIMessage } from 'ai';
import { and, asc, eq } from 'drizzle-orm';
import { streamAnalyst } from '@/agents/analystAgent';
import { getDb } from '@/db/client';
import { chatMessages, chatSessions, subjects, tokenUsage } from '@/db/schema';
import { usageRow } from '@/lib/cost';
import { getSubject } from './subjectService';

const TITLE_LENGTH = 40;

// Ownership is always checked by joining the session to its subject's owner_id,
// so another owner's session is simply "not found".
export function getChatSession(ownerId: number, sessionId: number) {
  return (
    getDb()
      .select({
        id: chatSessions.id,
        title: chatSessions.title,
        subject: { id: subjects.id, name: subjects.name },
      })
      .from(chatSessions)
      .innerJoin(subjects, eq(chatSessions.subjectId, subjects.id))
      .where(and(eq(chatSessions.id, sessionId), eq(subjects.ownerId, ownerId)))
      .get() ?? null
  );
}

export function createChatSession(ownerId: number, subjectId: number) {
  if (!getSubject(ownerId, subjectId)) return null;
  return getDb().insert(chatSessions).values({ subjectId, ownerId }).returning().get();
}

export function renameChatSession(ownerId: number, sessionId: number, title: string) {
  if (!getChatSession(ownerId, sessionId)) return null;
  return getDb().update(chatSessions).set({ title }).where(eq(chatSessions.id, sessionId)).returning().get();
}

export function deleteChatSession(ownerId: number, sessionId: number): boolean {
  if (!getChatSession(ownerId, sessionId)) return false;
  return getDb().delete(chatSessions).where(eq(chatSessions.id, sessionId)).run().changes > 0;
}

// Messages with the chat_turn token usage logged against each assistant reply (null otherwise).
function messageRows(sessionId: number) {
  return getDb()
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      costUsd: tokenUsage.estimatedCostUsd,
    })
    .from(chatMessages)
    .leftJoin(tokenUsage, and(eq(tokenUsage.scope, 'chat_turn'), eq(tokenUsage.refId, chatMessages.id)))
    .where(eq(chatMessages.chatSessionId, sessionId))
    .orderBy(asc(chatMessages.id))
    .all();
}

// History as UI messages. `tool` rows (tool names) are shown on the assistant reply that follows them.
export function listMessages(ownerId: number, sessionId: number): UIMessage[] | null {
  if (!getChatSession(ownerId, sessionId)) return null;
  const out: UIMessage[] = [];
  let tools: string[] = [];
  for (const row of messageRows(sessionId)) {
    if (row.role === 'tool') {
      tools.push(row.content);
      continue;
    }
    const toolParts = tools.map((toolName, i) => ({
      type: 'dynamic-tool' as const,
      toolName,
      toolCallId: `${row.id}-${i}`,
      state: 'output-available' as const,
      input: {},
      output: null,
    }));
    tools = [];
    const metadata =
      row.inputTokens === null ? undefined : { tokens: row.inputTokens + (row.outputTokens ?? 0), costUsd: row.costUsd ?? 0 };
    out.push({ id: String(row.id), role: row.role, metadata, parts: [...toolParts, { type: 'text', text: row.content }] });
  }
  return out;
}

// Saves the user turn, streams the Analyst Agent's reply, and persists it plus token usage when done.
export function sendMessage(ownerId: number, sessionId: number, text: string) {
  const session = getChatSession(ownerId, sessionId);
  if (!session) return null;
  const db = getDb();

  // History comes from the DB (text only), never from the client.
  const history: ModelMessage[] = messageRows(sessionId)
    .filter((r) => r.role !== 'tool')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));

  db.insert(chatMessages).values({ chatSessionId: sessionId, role: 'user', content: text }).run();
  if (!session.title) {
    db.update(chatSessions).set({ title: text.slice(0, TITLE_LENGTH).trim() }).where(eq(chatSessions.id, sessionId)).run();
  }

  const result = streamAnalyst({
    subject: session.subject,
    messages: [...history, { role: 'user', content: text }],
    onEnd: ({ text: reply, toolCalls, usage }) => {
      db.transaction((tx) => {
        for (const call of toolCalls) {
          tx.insert(chatMessages).values({ chatSessionId: sessionId, role: 'tool', content: call.toolName }).run();
        }
        const assistant = tx
          .insert(chatMessages)
          .values({ chatSessionId: sessionId, role: 'assistant', content: reply })
          .returning()
          .get();
        // ref_id = the assistant message id, so the badge can be shown again after reload.
        tx.insert(tokenUsage).values({ scope: 'chat_turn', refId: assistant.id, ...usageRow(usage) }).run();
      });
    },
  });
  // The live reply gets the same { tokens, costUsd } metadata that listMessages adds on reload.
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type !== 'finish') return undefined;
      const row = usageRow(part.totalUsage);
      return { tokens: row.inputTokens + row.outputTokens, costUsd: row.estimatedCostUsd };
    },
  });
}
