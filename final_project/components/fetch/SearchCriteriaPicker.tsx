'use client';

import { useEffect, useState } from 'react';
import { criteriaSummary, EMPTY_CRITERIA, isEmptyCriteria, type SearchCriteria } from '@/lib/searchCriteria';
import SearchCriteriaFields from './SearchCriteriaFields';

type SavedCriteria = { id: number; title: string; body: string; criteria: SearchCriteria | null };
// The fetch-runs POST fields for the chosen criteria (none -> {}).
export type CriteriaFocus = { criteria?: SearchCriteria; instructions?: string };

const NONE = 'none';
const NEW = 'new';
export const pickerFieldClass =
  'rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus';

// State of a search criteria picker: none, one of the tracker's saved criteria, or new criteria (optionally
// saved for this tracker). Used by the chat's fetch cards; render it with <SearchCriteriaPicker state={…} />.
export function useCriteriaChoice(subjectId: number, initial?: { promptId?: number; criteria?: SearchCriteria }) {
  const [saved, setSaved] = useState<SavedCriteria[]>([]);
  const [choice, setChoice] = useState(initial?.promptId ? String(initial.promptId) : initial?.criteria ? NEW : NONE);
  const [criteria, setCriteria] = useState<SearchCriteria>(initial?.criteria ?? EMPTY_CRITERIA);
  const [save, setSave] = useState(false);
  const [title, setTitle] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/prompts?kind=fetch&subjectId=${subjectId}`)
      .then((res) => (res.ok ? res.json() : { prompts: [] }))
      .then((data) => !cancelled && setSaved(data.prompts))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const selected = saved.find((p) => String(p.id) === choice);
  const label = choice === NEW ? criteriaSummary(criteria) || 'None' : selected ? selected.title : 'None (tracker details only)';

  // Saved criteria send their structured fields; a legacy row (no criteria) its text, so the overlap rule matches its earlier runs.
  const focusOf = (p: SavedCriteria): CriteriaFocus => (p.criteria ? { criteria: p.criteria } : { instructions: p.body });

  // Saves new criteria first when asked, then returns the POST fields for the choice.
  async function resolve(): Promise<{ focus: CriteriaFocus } | { error: string }> {
    if (choice === NEW && save) {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'fetch', title, criteria, allSubjects: false, subjectIds: [subjectId] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error ?? 'Could not save the search criteria.' };
      setSaved((ps) => [...ps, data.prompt]);
      setChoice(String(data.prompt.id));
      setSave(false);
      return { focus: focusOf(data.prompt) };
    }
    if (selected) return { focus: focusOf(selected) };
    if (choice === NEW && !isEmptyCriteria(criteria)) return { focus: { criteria } };
    return { focus: {} };
  }

  return {
    saved,
    choice,
    setChoice: (c: string) => {
      setChoice(c);
      setSave(false);
    },
    criteria,
    setCriteria,
    save,
    setSave,
    title,
    setTitle,
    selected,
    label,
    ready: !(choice === NEW && save && !title.trim()), // a save needs a title
    resolve,
  };
}

export type CriteriaChoice = ReturnType<typeof useCriteriaChoice>;

// The picker: a select (None / saved / New criteria…), the chosen criteria's summary, the "what we search
// with no criteria" line, and for new criteria the fields plus "Save for this tracker as [title]".
export default function SearchCriteriaPicker({ state, testId }: { state: CriteriaChoice; testId?: string }) {
  const { saved, choice, setChoice, criteria, setCriteria, save, setSave, title, setTitle, selected } = state;
  return (
    <>
      <label className="flex flex-col gap-xs text-sm font-medium">
        Search criteria
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={pickerFieldClass} data-testid={testId}>
          <option value={NONE}>None (tracker details only)</option>
          {saved.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value={NEW}>New criteria…</option>
        </select>
      </label>
      {selected && <p className="text-xs text-muted-foreground">{criteriaSummary(selected.criteria) || selected.body}</p>}
      <p className="text-xs text-muted-foreground" data-testid="setup-explainer">
        With no criteria we search news, reviews, Reddit, X, YouTube and blogs for this tracker&apos;s name, location and
        search terms.
      </p>

      {choice === NEW && (
        <>
          <SearchCriteriaFields value={criteria} onChange={setCriteria} />
          <div className="flex flex-wrap items-center gap-sm">
            <label className="flex items-center gap-xs">
              <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="accent-button" />
              Save for this tracker as
            </label>
            <input
              aria-label="Search criteria title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="Title"
              disabled={!save}
              className={`min-w-0 flex-1 disabled:opacity-60 ${pickerFieldClass}`}
            />
          </div>
        </>
      )}
    </>
  );
}
