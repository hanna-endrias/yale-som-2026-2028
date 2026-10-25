'use client';

import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import SubjectModal from '@/components/subjects/SubjectModal';
import type { SidebarSubject } from '@/services/subjectService';
import ChatSessionLink from './ChatSessionLink';

// Set by AddSubjectModal so the new subject's folder mounts expanded after router.refresh().
let newSubjectId: number | null = null;
export function expandNewSubject(id: number) {
  newSubjectId = id;
}

export default function SubjectFolder({ subject }: { subject: SidebarSubject }) {
  const router = useRouter();
  const pathname = usePathname();
  // Open when just created, or when it holds the session being viewed.
  const [expanded, setExpanded] = useState(
    () => subject.id === newSubjectId || subject.sessions.some((s) => pathname === `/chat/${s.id}`),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  async function newChat() {
    const res = await fetch(`/api/subjects/${subject.id}/chat-sessions`, { method: 'POST' });
    if (!res.ok) return;
    const { session } = await res.json();
    setExpanded(true);
    router.push(`/chat/${session.id}`);
    router.refresh();
  }

  return (
    <div>
      <div className="group flex items-center rounded-md hover:bg-background">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-xs px-sm py-xs text-left text-sm font-medium"
        >
          <Chevron className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{subject.name}</span>
        </button>
        <div className="flex opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            aria-label={`New chat in ${subject.name}`}
            onClick={newChat}
            className="rounded-sm p-xs hover:text-accent-text"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`${subject.name} settings`}
            onClick={() => setModalOpen(true)}
            className="rounded-sm p-xs hover:text-accent-text"
          >
            <MoreHorizontal className="size-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-col pl-md">
          {subject.sessions.length === 0 ? (
            <p className="px-sm py-xs text-sm text-muted-foreground">No chats yet</p>
          ) : (
            subject.sessions.map((s) => <ChatSessionLink key={s.id} session={s} />)
          )}
        </div>
      )}

      <SubjectModal subject={subject} open={modalOpen} onOpenChange={setModalOpen} />
    </div>
  );
}
