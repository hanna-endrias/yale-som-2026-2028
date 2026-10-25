'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import { ChatActionsProvider, type ChatActions, type SetupPrefill } from './ChatActions';
import ChatMessageBubble from './ChatMessageBubble';
import FetchSetupCard from './FetchSetupCard';
import StarterPrompts, { type StarterPrompt } from './StarterPrompts';

type Props = {
  sessionId: number;
  subjectId: number;
  subjectName: string;
  hasFetchRuns: boolean; // false -> an empty chat opens with the first-fetch setup card
  starterPrompts: StarterPrompt[];
  initialMessages: UIMessage[];
  aside?: React.ReactNode; // rendered beside the chat, inside the ChatActions provider
};

export default function ChatWindow({
  sessionId,
  subjectId,
  subjectName,
  hasFetchRuns,
  starterPrompts,
  initialMessages,
  aside,
}: Props) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setupRef = useRef<HTMLElement>(null);
  // The first-fetch card stays for this visit; after a reload the tracker has runs, so it's gone.
  const [firstSetup] = useState(() => !hasFetchRuns && initialMessages.length === 0);
  const [dataReady, setDataReady] = useState(hasFetchRuns);
  const [setupCards, setSetupCards] = useState<{ key: number; prefill?: SetupPrefill }[]>([]);
  // A starter prompt picked before any data, asked once the fetch finishes.
  const [queued, setQueued] = useState<string | null>(null);
  const handledRuns = useRef(new Set<string>());
  const [runsVersion, setRunsVersion] = useState(0);
  const { messages, sendMessage, status, error } = useChat({
    id: String(sessionId),
    messages: initialMessages,
    // Only the new turn's text is sent; the server loads history from the DB.
    transport: new DefaultChatTransport({
      api: `/api/chat-sessions/${sessionId}/messages`,
      prepareSendMessagesRequest: ({ messages }) => {
        const last = messages[messages.length - 1];
        return {
          body: {
            text: last.parts.map((p) => (p.type === 'text' ? p.text : '')).join(''),
          },
        };
      },
    }),
    // Refresh server data so the sidebar and header pick up the new title.
    onFinish: () => router.refresh(),
  });
  const busy = status === 'submitted' || status === 'streaming';
  // Index of the last user turn: cards in earlier messages know the owner has written since.
  let lastUser = -1;
  messages.forEach((m, i) => {
    if (m.role === 'user') lastUser = i;
  });

  useEffect(() => {
    if (messages.length || setupCards.length) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, setupCards]);

  function send(text: string) {
    if (!text.trim() || busy) return false;
    sendMessage({ text });
    setInput('');
    return true;
  }

  // Before any data a starter prompt doesn't reach the analyst: point at the setup card and remember the question.
  function pickStarter(text: string) {
    if (!firstSetup || dataReady) return send(text);
    setQueued(text);
    setupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setupRef.current?.focus({ preventScroll: true });
  }

  const actions: ChatActions = {
    sessionId,
    sendQuestion: (text) => void send(text),
    setDraft: (text) => {
      setInput(text);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        el?.focus();
        el?.setSelectionRange(text.length, text.length);
      });
    },
    addSetupCard: (prefill) => setSetupCards((cards) => [...cards, { key: Date.now(), prefill }]),
    onRunsDone: (runIds, followUp) => {
      const key = [...runIds].sort((a, b) => a - b).join(',');
      if (handledRuns.current.has(key)) return false;
      handledRuns.current.add(key);
      setDataReady(true);
      setRunsVersion((v) => v + 1);
      const question = followUp ?? queued;
      if (!question) return false;
      if (!followUp) setQueued(null);
      return send(question);
    },
    runsChanged: () => setRunsVersion((v) => v + 1),
    runsVersion,
  };

  return (
    <ChatActionsProvider value={actions}>
      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto p-md">
            {firstSetup && (
              <FetchSetupCard
                ref={setupRef}
                subjectId={subjectId}
                subjectName={subjectName}
                first
                highlighted={queued !== null}
                queuedQuestion={queued}
              />
            )}
            {messages.length === 0 ? (
              <StarterPrompts
                subjectName={subjectName}
                prompts={starterPrompts}
                onPick={pickStarter}
                waitingForData={firstSetup && !dataReady}
              />
            ) : (
              messages.map((m, i) => <ChatMessageBubble key={m.id} message={m} laterUserMessage={i < lastUser} />)
            )}
            {setupCards.map((c) => (
              <FetchSetupCard key={c.key} subjectId={subjectId} subjectName={subjectName} prefill={c.prefill} />
            ))}
            {status === 'submitted' && <p className="text-sm text-muted-foreground">Thinking…</p>}
            {error && (
              <p role="alert" className="text-sm font-semibold text-destructive">
                Something went wrong: {error.message}
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-sm border-t border-border p-md"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-sm py-sm focus-visible:outline-2 focus-visible:outline-focus"
            />
            <Button type="submit" disabled={busy || !input.trim()}>
              Send
            </Button>
          </form>
        </div>
        {aside}
      </div>
    </ChatActionsProvider>
  );
}
