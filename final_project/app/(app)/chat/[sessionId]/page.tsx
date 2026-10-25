import { notFound, redirect } from 'next/navigation';
import ChatWindow from '@/components/chat/ChatWindow';
import { sessionIdSchema } from '@/lib/validation/chat';
import { getCurrentUser } from '@/lib/session';
import { getChatSession, listMessages } from '@/services/chatService';
import { listPrompts } from '@/services/promptService';

export default async function ChatSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const id = sessionIdSchema.safeParse((await params).sessionId);
  const session = id.success ? getChatSession(user.id, id.data) : null;
  if (!session) notFound();
  // Only what the cards need crosses to the client.
  const analystPrompts = listPrompts(user.id, { kind: 'analyst', subjectId: session.subject.id });
  const starterPrompts = analystPrompts.map(({ id, title, body }) => ({ id, title, body }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex min-w-0 items-center gap-xs border-b border-border px-md py-sm text-sm">
        <span className="max-w-1/2 shrink-0 truncate font-semibold">{session.subject.name}</span>
        <span className="text-muted-foreground">›</span>
        <span className="truncate" data-testid="chat-title">
          {session.title ?? 'New chat'}
        </span>
      </header>
      <ChatWindow
        key={session.id}
        sessionId={session.id}
        subjectName={session.subject.name}
        starterPrompts={starterPrompts}
        initialMessages={listMessages(user.id, session.id) ?? []}
      />
    </div>
  );
}
