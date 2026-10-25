'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import { criteriaToInstructions, type SearchCriteriaInput } from '@/lib/searchCriteria';
import { PROMPT_KIND_LABEL } from '@/lib/validation/prompts';

type Kind = 'analyst' | 'fetch';
type Fields = { kind: Kind; title: string; body: string; allSubjects: boolean; subjectIds: number[] };
type LibraryPrompt = Fields & { id: number };
type Patch = Partial<Fields> & { criteria?: SearchCriteriaInput }; // criteria: search criteria (body is re-rendered)

// The updatePrompt tool's output (agents/tools/managePrompts.ts): a proposed change, not yet saved.
export type PromptUpdate = {
  id: number;
  subjectId: number;
  subjectName: string;
  before: Fields;
  patch: Patch;
};

export const isPromptUpdate = (o: unknown): o is PromptUpdate =>
  typeof o === 'object' && o !== null && 'before' in o && 'patch' in o;

export const KIND_LABEL: Record<Kind, string> = PROMPT_KIND_LABEL;
const sameIds = (a: number[], b: number[]) => [...a].sort().join() === [...b].sort().join();

// True when the saved prompt already has every field in the patch.
const matches = (p: LibraryPrompt, patch: Patch) =>
  (patch.kind === undefined || p.kind === patch.kind) &&
  (patch.title === undefined || p.title === patch.title) &&
  (patch.body === undefined || p.body === patch.body) &&
  (patch.criteria === undefined || p.body === criteriaToInstructions(patch.criteria)) &&
  (patch.allSubjects === undefined ||
    (p.allSubjects === patch.allSubjects && (patch.allSubjects || sameIds(p.subjectIds, patch.subjectIds ?? []))));

// Confirm card for a prompt change proposed in chat: only changed fields, old struck through, new in normal text.
// Only Save changes writes (PATCH /api/prompts/:id). On mount it checks the library so a reload shows the right state.
export default function PromptUpdateCard({ update }: { update: PromptUpdate }) {
  const [status, setStatus] = useState<'checking' | 'open' | 'saved' | 'gone' | 'cancelled'>('checking');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const { id, before, patch } = update;

  const scopeLabel = (allSubjects: boolean, subjectIds: number[]) =>
    allSubjects
      ? 'All trackers'
      : sameIds(subjectIds, [update.subjectId])
        ? `${update.subjectName} only`
        : `${subjectIds.length} ${subjectIds.length === 1 ? 'tracker' : 'trackers'}`;

  useEffect(() => {
    let cancelled = false;
    fetch('/api/prompts')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ prompts }: { prompts: LibraryPrompt[] }) => {
        if (cancelled) return;
        const current = prompts.find((p) => p.id === id);
        setStatus(!current ? 'gone' : matches(current, patch) ? 'saved' : 'open');
      })
      .catch(() => !cancelled && setStatus('open'));
    return () => {
      cancelled = true;
    };
  }, [id, patch]);

  async function save() {
    setPending(true);
    setError('');
    const res = await fetch(`/api/prompts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.ok) setStatus('saved');
    else if (res.status === 404) setStatus('gone');
    else setError(data.error ?? 'Could not save the prompt.');
  }

  const rows: { label: string; from: string; to: string }[] = [];
  if (patch.kind) rows.push({ label: 'Kind', from: KIND_LABEL[before.kind], to: KIND_LABEL[patch.kind] });
  if (patch.title !== undefined) rows.push({ label: 'Title', from: before.title, to: patch.title });
  if (patch.allSubjects !== undefined)
    rows.push({
      label: 'Scope',
      from: scopeLabel(before.allSubjects, before.subjectIds),
      to: scopeLabel(patch.allSubjects, patch.subjectIds ?? []),
    });
  if (patch.body !== undefined) rows.push({ label: 'Question', from: before.body, to: patch.body });
  if (patch.criteria !== undefined)
    rows.push({ label: 'Search criteria', from: before.body, to: criteriaToInstructions(patch.criteria) });
  const unchangedLabel = (patch.kind ?? before.kind) === 'fetch' ? 'Search criteria' : 'Question';

  const done = { saved: 'Saved.', gone: 'It no longer exists.', cancelled: 'Not changed.' } as const;

  return (
    <section className="w-full overflow-hidden rounded-md border border-border text-sm" data-testid="prompt-update-card">
      <header className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">Update {KIND_LABEL[before.kind].toLowerCase()}?</header>
      <div className="flex flex-col gap-xs px-sm py-sm">
        <p className="text-muted-foreground">
          {KIND_LABEL[before.kind]} · #{id}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-sm gap-y-xs">
          {rows.map((r) => (
            <div key={r.label} className="contents">
              <dt className="font-medium">{r.label}:</dt>
              <dd className="flex flex-wrap items-baseline gap-x-xs whitespace-pre-wrap break-words">
                <span className="text-muted-foreground line-through">{r.from}</span>
                <span aria-hidden>→</span>
                <span>{r.to}</span>
              </dd>
            </div>
          ))}
          {patch.body === undefined && patch.criteria === undefined && (
            <>
              <dt className="font-medium">{unchangedLabel}:</dt>
              <dd className="text-muted-foreground">(unchanged)</dd>
            </>
          )}
        </dl>

        {status === 'open' ? (
          <div className="flex flex-col gap-xs sm:items-end">
            <div className="flex flex-col gap-xs sm:flex-row">
              <button
                type="button"
                onClick={() => setStatus('cancelled')}
                disabled={pending}
                className="rounded-md border border-border px-md py-sm font-medium hover:bg-panel disabled:opacity-60"
              >
                Cancel
              </button>
              <Button type="button" onClick={save} disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
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
