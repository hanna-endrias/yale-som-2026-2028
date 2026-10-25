'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { formatRange } from '@/lib/dateRanges';

type FetchPrompt = { id: number; title: string; body: string };
type Skipped = { start: string; end: string; runId: number };
type StartedRun = { startDate: string; endDate: string; windows: number };

const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const fieldClass =
  'rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus';
const NONE = 'none';
const NEW = 'new';

// SubjectModal › Fetch runs: pick a range, cadence and optional fetcher prompt, then start a run.
// The prompt text can be edited for this run only, or saved to the library (scoped to this subject).
export default function FetchRunForm({ subjectId, onStarted }: { subjectId: number; onStarted: () => void }) {
  const [prompts, setPrompts] = useState<FetchPrompt[]>([]);
  const [choice, setChoice] = useState(NONE);
  const [text, setText] = useState('');
  const [save, setSave] = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/prompts?kind=fetch&subjectId=${subjectId}`)
      .then((res) => (res.ok ? res.json() : { prompts: [] }))
      .then((data) => !cancelled && setPrompts(data.prompts))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const selected = prompts.find((p) => String(p.id) === choice);
  const showText = choice !== NONE;
  const showSave = choice === NEW || (selected !== undefined && text !== selected.body);

  function pick(value: string) {
    setChoice(value);
    setText(prompts.find((p) => String(p.id) === value)?.body ?? '');
    setSave(false);
    setTitle('');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const instructions = showText ? text.trim() : '';
    setBusy(true);
    setError('');
    setNotes([]);
    try {
      if (showSave && save) {
        const res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'fetch', title, body: instructions, allSubjects: false, subjectIds: [subjectId] }),
        });
        const data = await res.json();
        if (!res.ok) return setError(data.error ?? 'Could not save the prompt.');
        setPrompts((ps) => [...ps, data.prompt]);
        setChoice(String(data.prompt.id));
        setSave(false);
        setTitle('');
      }
      const res = await fetch(`/api/subjects/${subjectId}/fetch-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, ...(instructions && { instructions }) }),
      });
      const data = await res.json();
      const skippedLines = ((data.skipped ?? []) as Skipped[]).map(
        (s) => `Skipped ${formatRange(s)} (already fetched in run #${s.runId}).`,
      );
      if (!res.ok) {
        setNotes(skippedLines);
        return setError(data.error ?? 'Could not start the fetch.');
      }
      const runs = data.runs as StartedRun[];
      const cadence = String(fields.cadence);
      const windows = runs.reduce((n, r) => n + r.windows, 0);
      setNotes([
        ...skippedLines,
        `Started ${runs.length} run${runs.length === 1 ? '' : 's'}: ${runs
          .map((r) => formatRange({ start: r.startDate, end: r.endDate }))
          .join(', ')} (${windows} ${cadence} window${windows === 1 ? '' : 's'}).`,
      ]);
      onStarted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-sm">
      <h3 className="font-heading font-semibold">Run a fetch</h3>
      <div className="flex flex-wrap items-end gap-sm">
        <Input label="Start" id="fetch-start" name="startDate" type="date" defaultValue={isoDaysAgo(7)} required />
        <Input label="End" id="fetch-end" name="endDate" type="date" defaultValue={isoDaysAgo(1)} required />
        {/* Stretched to the date fields' height so the labels line up (the select is slightly shorter). */}
        <label htmlFor="fetch-cadence" className="flex flex-col justify-between gap-xs self-stretch text-sm font-medium">
          Cadence
          <select id="fetch-cadence" name="cadence" defaultValue="daily" className={fieldClass}>
            <option value="daily">daily</option>
            <option value="weekly">weekly</option>
            <option value="monthly">monthly</option>
          </select>
        </label>
      </div>
      <label htmlFor="fetch-prompt" className="flex flex-col gap-xs text-sm font-medium">
        Prompt
        <select id="fetch-prompt" value={choice} onChange={(e) => pick(e.target.value)} className={fieldClass}>
          <option value={NONE}>None (base prompt only)</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value={NEW}>Write a new one…</option>
        </select>
      </label>
      {showText && (
        <textarea
          id="fetch-instructions"
          aria-label="Prompt text for this run"
          rows={3}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Prioritize review sites; skip press releases."
          className={`resize-y ${fieldClass}`}
        />
      )}
      {showSave && (
        <div className="flex flex-wrap items-center gap-sm text-sm">
          <label className="flex items-center gap-xs">
            <input
              id="fetch-save-prompt"
              type="checkbox"
              checked={save}
              onChange={(e) => setSave(e.target.checked)}
              className="accent-button"
            />
            Save to library as
          </label>
          <input
            id="fetch-save-title"
            aria-label="Prompt title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            required={save}
            placeholder="Title"
            className={`min-w-0 flex-1 ${fieldClass}`}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={busy}>
          Run
        </Button>
      </div>
      {notes.map((note) => (
        <p key={note} className="text-sm text-muted-foreground">
          {note}
        </p>
      ))}
    </form>
  );
}
