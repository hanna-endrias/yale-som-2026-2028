import { notFound, redirect } from 'next/navigation';
import ChatSidePanel, { ChatPanelProvider, ChatPanelToggle } from '@/components/chat/ChatSidePanel';
import ChatWindow from '@/components/chat/ChatWindow';
import { sessionIdSchema } from '@/lib/validation/chat';
import { getCurrentUser } from '@/lib/session';
import { getChatSession, listMessages } from '@/services/chatService';
import { hasFetchRuns } from '@/services/fetchRunService';
import { listPrompts } from '@/services/promptService';
import { listSubjects } from '@/services/subjectService';

export default async function ChatSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const id = sessionIdSchema.safeParse((await params).sessionId);
  const session = id.success ? getChatSession(user.id, id.data) : null;
  if (!session) notFound();
  // Only what the cards need crosses to the client.
  const analystPrompts = listPrompts(user.id, { kind: 'analyst', subjectId: session.subject.id });
  const starterPrompts = analystPrompts.map(({ id, title, body }) => ({ id, title, body }));
  const subjects = listSubjects(user.id).map(({ id, name }) => ({ id, name })); // the prompt editor's scope options

  return (
    <ChatPanelProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="flex min-w-0 items-center gap-xs border-b border-border px-md py-sm text-sm">
          <span className="max-w-1/2 shrink-0 truncate font-semibold">{session.subject.name}</span>
          <span className="text-muted-foreground">›</span>
          <span className="truncate" data-testid="chat-title">
            {session.title ?? 'New chat'}
          </span>
          <ChatPanelToggle />
        </header>
        <ChatWindow
          key={session.id}
          sessionId={session.id}
          subjectId={session.subject.id}
          subjectName={session.subject.name}
          hasFetchRuns={hasFetchRuns(user.id, session.subject.id)}
          starterPrompts={starterPrompts}
          initialMessages={listMessages(user.id, session.id) ?? []}
          aside={<ChatSidePanel subjectId={session.subject.id} subjectName={session.subject.name} subjects={subjects} />}
        />
      </div>
    </ChatPanelProvider>
  );
}
