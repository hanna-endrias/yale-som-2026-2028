'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Modal from '@/components/common/Modal';
import SearchCriteriaFields from '@/components/fetch/SearchCriteriaFields';
import { cancelClass } from '@/components/subjects/SubjectEditForm';
import { criteriaForEditing, EMPTY_CRITERIA } from '@/lib/searchCriteria';
import { PROMPT_KIND_LABEL as KIND_LABEL } from '@/lib/validation/prompts';
import type { PromptItem } from '@/services/promptService';

export type SubjectOption = { id: number; name: string };

type Props = {
  prompt: PromptItem | null; // null = new prompt
  defaultKind: PromptItem['kind'];
  subjects: SubjectOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSubjectIds?: number[]; // a new prompt's scope starts as these trackers instead of all trackers
  onSaved?: () => void; // after a save or delete (the chat side panel reloads its lists)
};

const deleteClass =
  'rounded-md border border-destructive px-md py-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60';
const legendClass = 'mb-xs text-sm font-medium';
const optionClass = 'flex items-center gap-xs text-sm';
// Action row pinned to the bottom of the scrolling modal (bleeds over Modal's p-lg), so Save/Cancel stay visible.
const footerClass = 'sticky -bottom-lg z-10 -mx-lg -mb-lg border-t border-border bg-popover px-lg py-md';

// Create, edit or delete one chat question or saved search criteria. Opened from PromptList.
// Search criteria use SearchCriteriaFields; a legacy one without structured criteria opens with its text in Notes.
export default function PromptEditorModal({
  prompt,
  defaultKind,
  subjects,
  open,
  onOpenChange,
  defaultSubjectIds,
  onSaved,
}: Props) {
  const router = useRouter();
  const [kind, setKind] = useState(prompt?.kind ?? defaultKind);
  const [title, setTitle] = useState(prompt?.title ?? '');
  const [body, setBody] = useState(prompt?.kind === 'analyst' ? prompt.body : '');
  const [criteria, setCriteria] = useState(prompt?.kind === 'fetch' ? criteriaForEditing(prompt) : EMPTY_CRITERIA);
  const [allSubjects, setAllSubjects] = useState(prompt?.allSubjects ?? !defaultSubjectIds?.length);
  const [subjectIds, setSubjectIds] = useState<number[]>(prompt?.subjectIds ?? defaultSubjectIds ?? []);
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
      body: JSON.stringify({
        kind,
        title,
        ...(kind === 'fetch' ? { criteria } : { body }),
        allSubjects,
        subjectIds: allSubjects ? [] : subjectIds,
      }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not save.');
    onOpenChange(false);
    onSaved?.();
    router.refresh();
  }

  async function onDelete() {
    if (!prompt) return;
    setBusy(true);
    const res = await fetch(`/api/prompts/${prompt.id}`, { method: 'DELETE' });
    setBusy(false);
    if (!res.ok) return setError((await res.json()).error ?? 'Could not delete.');
    onOpenChange(false);
    onSaved?.();
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={`${prompt ? 'Edit' : 'New'} ${KIND_LABEL[kind].toLowerCase()}`}>
      <form onSubmit={onSave} className="flex flex-col gap-sm">
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
                {KIND_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>

        <Input label="Title" id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} />

        {kind === 'analyst' ? (
          <label htmlFor="prompt-body" className="flex flex-col gap-xs text-sm font-medium">
            Question
            <textarea
              id="prompt-body"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="resize-y rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus"
            />
            <span className="text-xs font-normal text-muted-foreground">Sent to the analyst as your question.</span>
          </label>
        ) : (
          <div className="flex flex-col gap-xs">
            <SearchCriteriaFields value={criteria} onChange={setCriteria} />
            <span className="text-xs text-muted-foreground">
              Steers the web search when you fetch with these criteria. Empty fields mean no constraint.
            </span>
          </div>
        )}

        <fieldset>
          <legend className={legendClass}>Trackers</legend>
          <div className="flex flex-col gap-xs">
            <label className={optionClass}>
              <input
                type="checkbox"
                checked={allSubjects}
                onChange={(e) => setAllSubjects(e.target.checked)}
                className="accent-button"
              />
              All trackers
            </label>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No trackers yet.</p>
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
          <div className={`flex flex-wrap items-center justify-end gap-sm ${footerClass}`}>
            <p className="basis-full text-sm">Delete &ldquo;{prompt?.title}&rdquo;?</p>
            <button type="button" onClick={() => setConfirming(false)} className={cancelClass}>
              Cancel
            </button>
            <button type="button" onClick={onDelete} disabled={busy} className={deleteClass}>
              Delete
            </button>
          </div>
        ) : (
          <div className={`flex flex-wrap items-center justify-between gap-sm ${footerClass}`}>
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
