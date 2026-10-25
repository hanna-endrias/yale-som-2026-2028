'use client';

import { useId, useState } from 'react';
import Button from '@/components/common/Button';
import DateField from '@/components/common/DateField';
import SearchCriteriaPicker, { pickerFieldClass, useCriteriaChoice } from '@/components/fetch/SearchCriteriaPicker';
import { formatRange } from '@/lib/dateRanges';
import { useChatActions, type SetupPrefill } from './ChatActions';
import FetchRunProgress, { type Run } from './FetchRunProgress';

type Skipped = { start: string; end: string; runId: number };

type Props = {
  subjectId: number;
  subjectName: string;
  prefill?: SetupPrefill;
  first?: boolean; // the tracker's first fetch (shown in an empty chat)
  highlighted?: boolean; // a starter prompt was picked before any data: draw attention here
  queuedQuestion?: string | null; // asked once the fetch finishes
  ref?: React.Ref<HTMLElement>; // ChatWindow scrolls here when a starter prompt is picked
};

// Local calendar day, so "yesterday" matches the owner's calendar.
export const isoDaysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Client-only chat card (no LLM) that starts a fetch: dates, cadence and search criteria, then live status.
// When the runs are done it calls onRunsDone, which asks the question remembered from a starter prompt.
export default function FetchSetupCard({ subjectId, subjectName, prefill, first, highlighted, queuedQuestion, ref }: Props) {
  const { onRunsDone, runsChanged } = useChatActions();
  const uid = useId();
  const [startDate, setStartDate] = useState(prefill?.startDate ?? isoDaysAgo(7));
  const [endDate, setEndDate] = useState(prefill?.endDate ?? isoDaysAgo(1));
  const [cadence, setCadence] = useState(prefill?.cadence ?? 'daily');
  const picker = useCriteriaChoice(subjectId, prefill);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const [runIds, setRunIds] = useState<number[] | null>(null);
  const [result, setResult] = useState<{ mentions: number; asked: boolean } | null>(null);

  async function start() {
    setBusy(true);
    setError('');
    setNotes([]);
    try {
      const chosen = await picker.resolve();
      if ('error' in chosen) return setError(chosen.error);
      const res = await fetch(`/api/subjects/${subjectId}/fetch-runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, cadence, ...chosen.focus }),
      });
      const data = await res.json().catch(() => ({}));
      const skipped = ((data.skipped ?? []) as Skipped[]).map(
        (s) => `Skipped ${formatRange(s)} (already fetched in run #${s.runId}).`,
      );
      setNotes(skipped);
      if (res.status !== 201) return setError(data.error ?? 'Could not start the fetch.');
      setRunIds((data.runs as Run[]).map((r) => r.id));
      runsChanged();
    } finally {
      setBusy(false);
    }
  }

  function allDone(runs: Run[]) {
    const asked = onRunsDone(runs.map((r) => r.id));
    setResult({ mentions: runs.reduce((n, r) => n + r.mentionCount, 0), asked });
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      data-testid="fetch-setup-card"
      data-highlighted={highlighted || undefined}
      className={`w-full max-w-xl shrink-0 self-center overflow-hidden rounded-md border text-sm transition-shadow focus:outline-none ${
        highlighted ? 'border-accent-text ring-2 ring-focus' : 'border-border'
      }`}
    >
      <header className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">
        {first ? 'Set up your first fetch' : 'New fetch'}
      </header>
      <div className="flex flex-col gap-sm px-sm py-sm">
        <p className="font-medium">Let&apos;s find what people are saying about {subjectName}.</p>

        {runIds ? (
          <>
            <p className="text-muted-foreground">
              {formatRange({ start: startDate, end: endDate })} · {cadence} · Search criteria: {picker.label}
            </p>
            <FetchRunProgress subjectId={subjectId} runIds={runIds} onAllDone={allDone} />
            {result && (
              <p className="font-medium" data-testid="fetch-setup-done">
                Done: {plural(result.mentions, 'mention')}.{' '}
                {result.asked ? 'Your question was sent below.' : 'Ask a question below.'}
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-sm">
              <DateField label="Start" id={`${uid}-start`} name="startDate" defaultValue={startDate} max={endDate} onChange={setStartDate} />
              <DateField label="End" id={`${uid}-end`} name="endDate" defaultValue={endDate} min={startDate} max={isoDaysAgo(0)} onChange={setEndDate} />
              {/* Stretched to the date fields' height so the labels line up. */}
              <label className="flex flex-col justify-between gap-xs self-stretch text-sm font-medium">
                Cadence
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as typeof cadence)}
                  className={pickerFieldClass}
                  data-testid="setup-cadence"
                >
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </label>
            </div>

            <SearchCriteriaPicker state={picker} testId="setup-criteria" />

            {queuedQuestion && (
              <p className="rounded-md bg-panel px-sm py-xs" data-testid="setup-queued">
                We&apos;ll ask this once the fetch finishes: <span className="font-medium">&ldquo;{queuedQuestion}&rdquo;</span>
              </p>
            )}
            {error && (
              <p role="alert" className="font-semibold text-destructive">
                {error}
              </p>
            )}
            <div className="flex sm:justify-end">
              <Button
                type="button"
                onClick={start}
                disabled={busy || !picker.ready}
                className="w-full sm:w-auto"
              >
                {busy ? 'Starting…' : 'Start fetch'}
              </Button>
            </div>
          </>
        )}
        {notes.map((n) => (
          <p key={n} className="text-muted-foreground">
            {n}
          </p>
        ))}
        {runIds && queuedQuestion && !result && (
          <p className="text-muted-foreground" data-testid="setup-queued">
            We&apos;ll ask this once the fetch finishes: &ldquo;{queuedQuestion}&rdquo;
          </p>
        )}
      </div>
    </section>
  );
}
