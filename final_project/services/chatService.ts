import type { LanguageModelUsage, ModelMessage, UIMessage } from 'ai';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { CARD_TOOLS, streamAnalyst } from '@/agents/analystAgent';
import { getDb } from '@/db/client';
import { chatMessages, chatSessions, mentions, subjects, tokenUsage } from '@/db/schema';
import { usageRow } from '@/lib/cost';
import { extractUrls } from '@/lib/links';
import { getSubject } from './subjectService';

const TITLE_LENGTH = 40;

// What an assistant message carries besides its parts (set live on finish and rebuilt on reload).
export type AssistantMetadata = { tokens: number; costUsd: number; unverifiedUrls: string[] };

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
      payload: chatMessages.payload,
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

// URLs in `text` that are not stored mention URLs of this subject (likely invented sources).
function unverifiedUrls(subjectId: number, text: string): string[] {
  const urls = [...new Set(extractUrls(text))];
  if (!urls.length) return [];
  const known = new Set(
    getDb()
      .select({ url: mentions.url })
      .from(mentions)
      .where(and(eq(mentions.subjectId, subjectId), inArray(mentions.url, urls)))
      .all()
      .map((r) => r.url),
  );
  return urls.filter((u) => !known.has(u));
}

// History as UI messages. `tool` rows (tool name + optional JSON payload) are shown on the assistant reply that follows them.
export function listMessages(ownerId: number, sessionId: number): UIMessage[] | null {
  const session = getChatSession(ownerId, sessionId);
  if (!session) return null;
  const out: UIMessage[] = [];
  let tools: { toolName: string; payload: string | null }[] = [];
  for (const row of messageRows(sessionId)) {
    if (row.role === 'tool') {
      tools.push({ toolName: row.content, payload: row.payload });
      continue;
    }
    const toolParts = tools.map(({ toolName, payload }, i) => ({
      type: 'dynamic-tool' as const,
      toolName,
      toolCallId: `${row.id}-${i}`,
      state: 'output-available' as const,
      input: {},
      output: payload ? JSON.parse(payload) : null,
    }));
    tools = [];
    const metadata: AssistantMetadata | undefined =
      row.inputTokens === null
        ? undefined
        : {
            tokens: row.inputTokens + (row.outputTokens ?? 0),
            costUsd: row.costUsd ?? 0,
            unverifiedUrls: unverifiedUrls(session.subject.id, row.content),
          };
    out.push({ id: String(row.id), role: row.role, metadata, parts: [...toolParts, { type: 'text', text: row.content }] });
  }
  return out;
}

// Token counts and cost summed across the analyst's steps and any LLM calls made inside tools.
function sumUsage(usages: LanguageModelUsage[]) {
  const rows = usages.map(usageRow);
  const sum = (k: keyof (typeof rows)[number]) => rows.reduce((n, r) => n + r[k], 0);
  return {
    inputTokens: sum('inputTokens'),
    outputTokens: sum('outputTokens'),
    cachedTokens: sum('cachedTokens'),
    estimatedCostUsd: sum('estimatedCostUsd'),
  };
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

  // LLM calls made inside tools (the visualizer) report their usage here, so the turn's cost includes them.
  const toolUsage: LanguageModelUsage[] = [];
  const result = streamAnalyst({
    ownerId,
    subject: session.subject,
    messages: [...history, { role: 'user', content: text }],
    onToolUsage: (usage) => toolUsage.push(usage),
    // steps/totalUsage cover the whole tool loop; the event's top-level toolCalls/usage are the final step's only.
    onEnd: ({ steps, totalUsage }) => {
      const reply = steps
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join('\n\n');
      db.transaction((tx) => {
        for (const r of steps.flatMap((s) => s.toolResults)) {
          const payload = CARD_TOOLS.has(r.toolName) ? JSON.stringify(r.output) : null;
          tx.insert(chatMessages).values({ chatSessionId: sessionId, role: 'tool', content: r.toolName, payload }).run();
        }
        const assistant = tx
          .insert(chatMessages)
          .values({ chatSessionId: sessionId, role: 'assistant', content: reply })
          .returning()
          .get();
        // ref_id = the assistant message id, so the badge can be shown again after reload.
        tx.insert(tokenUsage)
          .values({ scope: 'chat_turn', refId: assistant.id, ...sumUsage([totalUsage, ...toolUsage]) })
          .run();
      });
    },
  });
  // The live reply gets the same metadata that listMessages adds on reload. Streamed text is collected
  // so its links can be checked against stored mentions when the turn finishes.
  let streamed = '';
  return result.toUIMessageStreamResponse({
    messageMetadata: ({ part }) => {
      if (part.type === 'text-delta') streamed += part.text;
      if (part.type !== 'finish') return undefined;
      const row = sumUsage([part.totalUsage, ...toolUsage]);
      const metadata: AssistantMetadata = {
        tokens: row.inputTokens + row.outputTokens,
        costUsd: row.estimatedCostUsd,
        unverifiedUrls: unverifiedUrls(session.subject.id, streamed),
      };
      return metadata;
    },
  });
}
