'use client';

import { useEffect, useState } from 'react';
import { KIND_LABEL } from './PromptUpdateCard';

// The deletePrompt tool's output (agents/tools/managePrompts.ts): a prompt to delete, not yet deleted.
export type PromptDelete = { id: number; kind: 'analyst' | 'fetch'; title: string; body: string };

export const isPromptDelete = (o: unknown): o is PromptDelete =>
  typeof o === 'object' && o !== null && typeof (o as { id?: unknown }).id === 'number' && 'title' in o;

// Confirm card for a prompt deletion asked for in chat. Only Delete writes (DELETE /api/prompts/:id).
// On mount it checks the library so a reload shows "Deleted." when the prompt is gone.
export default function PromptDeleteCard({ prompt }: { prompt: PromptDelete }) {
  const [status, setStatus] = useState<'checking' | 'open' | 'deleted' | 'already' | 'kept'>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/prompts')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ prompts }: { prompts: { id: number }[] }) => {
        if (!cancelled) setStatus(prompts.some((p) => p.id === prompt.id) ? 'open' : 'deleted');
      })
      .catch(() => !cancelled && setStatus('open'));
    return () => {
      cancelled = true;
    };
  }, [prompt.id]);

  async function remove() {
    setPending(true);
    setError('');
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) setStatus('deleted');
    else if (res.status === 404) setStatus('already');
    else setError(data.error ?? 'Could not delete it.');
  }

  const done = { deleted: 'Deleted.', already: 'Already deleted.', kept: 'Kept.' } as const;

  return (
    <section className="w-full overflow-hidden rounded-md border border-border text-sm" data-testid="prompt-delete-card">
      <header className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">Delete {KIND_LABEL[prompt.kind].toLowerCase()}?</header>
      <div className="flex flex-col gap-xs px-sm py-sm">
        <p className="font-medium">
          {KIND_LABEL[prompt.kind]} · “{prompt.title}”
        </p>
        <p className="line-clamp-3 whitespace-pre-wrap break-words text-muted-foreground">{prompt.body}</p>

        {status === 'open' ? (
          <div className="flex flex-col gap-xs sm:items-end">
            <div className="flex flex-col gap-xs sm:flex-row">
              <button
                type="button"
                onClick={() => setStatus('kept')}
                disabled={pending}
                className="rounded-md border border-border px-md py-sm font-medium hover:bg-panel disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="rounded-md border border-destructive px-md py-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
              >
                {pending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
            {error && <p className="text-destructive">{error}</p>}
          </div>
        ) : (
          status !== 'checking' && (
            <p className="font-medium" data-testid="prompt-card-status">
              {done[status]}
            </p>
          )
        )}
      </div>
    </section>
  );
}
