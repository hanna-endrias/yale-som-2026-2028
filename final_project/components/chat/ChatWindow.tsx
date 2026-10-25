'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import ChatMessageBubble from './ChatMessageBubble';
import StarterPrompts, { type StarterPrompt } from './StarterPrompts';

type Props = {
  sessionId: number;
  subjectName: string;
  starterPrompts: StarterPrompt[];
  initialMessages: UIMessage[];
};

export default function ChatWindow({ sessionId, subjectName, starterPrompts, initialMessages }: Props) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function send(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput('');
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto p-md">
        {messages.length === 0 ? (
          <StarterPrompts subjectName={subjectName} prompts={starterPrompts} onPick={send} />
        ) : (
          messages.map((m) => <ChatMessageBubble key={m.id} message={m} />)
        )}
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
  );
}
