'use client';

import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import { cancelClass } from '@/components/subjects/SubjectEditForm';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Props = { session: { id: number; title: string | null } };

export default function ChatSessionLink({ session }: Props) {
  const router = useRouter();
  const href = `/chat/${session.id}`;
  const active = usePathname() === href;
  const title = session.title ?? 'New chat';
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function open(which: 'rename' | 'delete') {
    setError('');
    setDialog(which);
  }

  async function rename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch(`/api/chat-sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: new FormData(e.currentTarget).get('title') }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not rename.');
    setDialog(null);
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/chat-sessions/${session.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not delete.');
    setDialog(null);
    if (active) router.push('/chat');
    router.refresh();
  }

  return (
    <div className={`group flex items-center rounded-md hover:bg-background ${active ? 'bg-background' : ''}`}>
      <Link
        href={href}
        className={`min-w-0 flex-1 truncate px-sm py-xs text-sm ${active ? 'font-semibold text-accent-text' : ''}`}
      >
        {title}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Chat options"
          className="rounded-sm p-xs opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-accent-text data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => open('rename')}>Rename</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => open('delete')} className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={dialog === 'delete' ? 'Delete chat' : 'Rename chat'}
      >
        {dialog === 'rename' ? (
          <form onSubmit={rename} className="flex flex-col gap-md">
            <Input label="Title" id={`chat-title-${session.id}`} name="title" defaultValue={session.title ?? ''} autoFocus />
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <div className="flex justify-end gap-sm">
              <button type="button" onClick={() => setDialog(null)} className={cancelClass}>
                Cancel
              </button>
              <Button type="submit" disabled={busy}>
                Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="text-sm">Delete &ldquo;{title}&rdquo; and all its messages?</p>
            {error && <p role="alert" className="text-sm font-semibold text-destructive">{error}</p>}
            <div className="flex justify-end gap-sm">
              <button type="button" onClick={() => setDialog(null)} className={cancelClass}>
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="rounded-md border border-destructive px-md py-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
