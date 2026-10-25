'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import { cancelClass } from '@/components/subjects/SubjectEditForm';
import type { PromptItem } from '@/services/promptService';

export type SubjectOption = { id: number; name: string };

type Props = {
  prompt: PromptItem | null; // null = new prompt
  defaultKind: PromptItem['kind'];
  subjects: SubjectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const deleteClass =
  'rounded-md border border-destructive px-md py-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60';
const legendClass = 'mb-xs text-sm font-medium';
const optionClass = 'flex items-center gap-xs text-sm';

// Create, edit or delete one library prompt. Opened from PromptList.
export default function PromptEditorModal({ prompt, defaultKind, subjects, open, onOpenChange }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState(prompt?.kind ?? defaultKind);
  const [title, setTitle] = useState(prompt?.title ?? '');
  const [body, setBody] = useState(prompt?.body ?? '');
  const [allSubjects, setAllSubjects] = useState(prompt?.allSubjects ?? true);
  const [subjectIds, setSubjectIds] = useState<number[]>(prompt?.subjectIds ?? []);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function toggleSubject(id: number, checked: boolean) {
    setSubjectIds((ids) => (checked ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    // Scope is always sent as a pair (the PATCH API requires allSubjects + subjectIds together).
    const res = await fetch(prompt ? `/api/prompts/${prompt.id}` : '/api/prompts', {
      method: prompt ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, title, body, allSubjects, subjectIds: allSubjects ? [] : subjectIds }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not save.');
    onOpenChange(false);
    router.refresh();
  }

  async function onDelete() {
    if (!prompt) return;
    setBusy(true);
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not delete.');
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={prompt ? 'Edit prompt' : 'New prompt'}>
      <form onSubmit={onSave} className="flex flex-col gap-md">
        <fieldset>
          <legend className={legendClass}>Type</legend>
          <div className="flex flex-wrap gap-md">
            {(['analyst', 'fetch'] as const).map((k) => (
              <label key={k} className={optionClass}>
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={kind === k}
                  onChange={() => setKind(k)}
                  className="accent-button"
                />
                {k === 'analyst' ? 'Analyst' : 'Fetcher'}
              </label>
            ))}
          </div>
        </fieldset>

        <Input label="Title" id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} />

        <label htmlFor="prompt-body" className="flex flex-col gap-xs text-sm font-medium">
          Prompt
          <textarea
            id="prompt-body"
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="resize-y rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus"
          />
          <span className="text-xs font-normal text-muted-foreground">
            Analyst prompts are sent as your question. Fetcher prompts are added to the fetch agent&apos;s
            instructions for that run.
          </span>
        </label>

        <fieldset>
          <legend className={legendClass}>Subjects</legend>
          <div className="flex flex-col gap-xs">
            <label className={optionClass}>
              <input
                type="checkbox"
                checked={allSubjects}
                onChange={(e) => setAllSubjects(e.target.checked)}
                className="accent-button"
              />
              All subjects
            </label>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects yet.</p>
            ) : (
              <div className="flex flex-wrap gap-x-md gap-y-xs">
                {subjects.map((s) => (
                  <label key={s.id} className={`${optionClass} ${allSubjects ? 'text-muted-foreground' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!allSubjects && subjectIds.includes(s.id)}
                      disabled={allSubjects}
                      onChange={(e) => toggleSubject(s.id, e.target.checked)}
                      className="accent-button"
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}

        {confirming ? (
          <div className="flex flex-wrap items-center justify-end gap-sm">
            <p className="basis-full text-sm">Delete &ldquo;{prompt?.title}&rdquo;?</p>
            <button type="button" onClick={() => setConfirming(false)} className={cancelClass}>
              Cancel
            </button>
            <button type="button" onClick={onDelete} disabled={busy} className={deleteClass}>
              Delete
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-sm">
            {prompt ? (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setConfirming(true);
                }}
                className={deleteClass}
              >
                Delete
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-sm">
              <button type="button" onClick={() => onOpenChange(false)} className={cancelClass}>
                Cancel
              </button>
              <Button type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
