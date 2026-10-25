'use client';

import { useEffect, useId, useState } from 'react';
import Button from '@/components/common/Button';
import DateField from '@/components/common/DateField';
import SearchCriteriaPicker, { pickerFieldClass, useCriteriaChoice } from '@/components/fetch/SearchCriteriaPicker';
import { formatRange } from '@/lib/dateRanges';
import { EMPTY_CRITERIA, type SearchCriteria } from '@/lib/searchCriteria';
import { useChatActions } from './ChatActions';
import { isoDaysAgo } from './FetchSetupCard';
import FetchRunProgress, { type Run } from './FetchRunProgress';

type Cadence = 'daily' | 'weekly' | 'monthly';
type Skipped = { start: string; end: string; runId: number; status?: string };
// What Start fetch actually started; saved on the card's message (PATCH /api/chat-sessions/:id/fetch-plan).
type Started = {
  runIds: number[];
  startDate: string;
  endDate: string;
  cadence: Cadence;
  criteriaLabel: string;
  edited: boolean; // false: started as planned
};

// The planFetchRun tool's output (agents/tools/planFetchRun.ts).
export type FetchPlan = {
  subjectId: number;
  subjectName: string;
  startDate: string;
  endDate: string;
  cadence: Cadence;
  promptId?: number; // saved search criteria
  promptTitle?: string;
  criteria?: SearchCriteria; // one-time search criteria
  followUpQuestion?: string; // asked again once the fetch is done
  instructions: string | null;
  gaps: { start: string; end: string; windows: number }[];
  skipped: { start: string; end: string; runId: number; status: string }[];
  totalWindows: number;
  started?: Started; // set once the card's Start fetch succeeded
};

export const isFetchPlan = (o: unknown): o is FetchPlan =>
  typeof o === 'object' && o !== null && Array.isArray((o as { gaps?: unknown }).gaps);

const windowsLabel = (n: number) => `${n} ${n === 1 ? 'window' : 'windows'}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
// "Jan 1–Jan 7, 2025", or "Dec 30, 2024–Jan 2, 2025" across years (the plan can be for any year).
const day = (iso: string) => formatRange({ start: iso, end: iso }).split('–')[0];
const rangeWithYear = ({ start, end }: { start: string; end: string }) =>
  start.slice(0, 4) === end.slice(0, 4)
    ? `${formatRange({ start, end })}, ${start.slice(0, 4)}`
    : `${day(start)}, ${start.slice(0, 4)}–${day(end)}, ${end.slice(0, 4)}`;
const editedView = (s: Started) => ({ start: s.startDate, end: s.endDate, cadence: s.cadence, criteria: s.criteriaLabel });
const linkClass = 'text-accent-text underline-offset-2 hover:text-accent-hover hover:underline';

type Props = {
  plan: FetchPlan;
  toolCallId: string; // identifies the card's message when recording what it started
  laterUserMessage?: boolean; // a user turn follows this card in the chat: never send the follow-up question
};

// Chat card for a planned fetch: shows the gaps and a Start button (the only way a chat fetch starts), with an
// Edit link to change the dates, cadence and search criteria first. Then the started runs' live status
// (FetchRunProgress); when they are all done, a plan with a followUpQuestion asks it as the next user turn.
// On reload it shows what it started (saved on its message, edited or not); an older card without that record
// finds its runs by matching each planned gap in the run history.
export default function FetchPlanCard({ plan, toolCallId, laterUserMessage = false }: Props) {
  const { sessionId, onRunsDone, runsChanged } = useChatActions();
  const uid = useId();
  const [runIds, setRunIds] = useState<number[] | null>(plan.started?.runIds ?? null);
  const [checked, setChecked] = useState(!!plan.started);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Skipped[] | null>(null); // the server's `skipped` after Start
  const [editing, setEditing] = useState(false);
  const [startDate, setStartDate] = useState(plan.startDate);
  const [endDate, setEndDate] = useState(plan.endDate);
  const [cadence, setCadence] = useState<Cadence>(plan.cadence);
  // Edit mode starts from the plan's criteria; a legacy one-time plan (text only) opens as Notes.
  const picker = useCriteriaChoice(plan.subjectId, {
    promptId: plan.promptId,
    criteria: plan.criteria ?? (plan.instructions && !plan.promptTitle ? { ...EMPTY_CRITERIA, notes: plan.instructions } : undefined),
  });
  // An edited start replaces the plan's range, cadence and criteria in the card.
  const [started, setStarted] = useState<{ start: string; end: string; cadence: Cadence; criteria: string } | null>(() =>
    plan.started?.edited ? editedView(plan.started) : null,
  );
  const [result, setResult] = useState<{ mentions: number; asked: boolean } | null>(null);
  const url = `/api/subjects/${plan.subjectId}/fetch-runs`;
  // Saved criteria show their title; one-time criteria their rendered text on one line.
  const criteria = plan.promptTitle ?? (plan.instructions ? `“${plan.instructions.replace(/\s*\n\s*/g, ' · ')}”` : 'None');

  // On mount, for a card with no saved start: were this plan's gaps already started (e.g. before a reload)?
  useEffect(() => {
    if (!plan.gaps.length || plan.started) return;
    let cancelled = false;
    fetch(url)
      .then((res) => (res.ok ? res.json() : { runs: [] }))
      .then(({ runs: all }: { runs: Run[] }) => {
        if (cancelled) return;
        const found = plan.gaps.map((g) =>
          all.find(
            (r) =>
              r.startDate === g.start &&
              r.endDate === g.end &&
              r.cadence === plan.cadence &&
              (r.instructions ?? '').trim() === (plan.instructions ?? ''),
          ),
        );
        if (found.every(Boolean)) setRunIds(found.map((r) => r!.id));
        setChecked(true);
      })
      .catch(() => setChecked(true));
    return () => {
      cancelled = true;
    };
  }, [url, plan]);

  async function start() {
    setPending(true);
    setMessage('');
    setNotes(null);
    try {
      let body: object = {
        startDate: plan.startDate,
        endDate: plan.endDate,
        cadence: plan.cadence,
        instructions: plan.instructions ?? undefined,
      };
      if (editing) {
        const chosen = await picker.resolve();
        if ('error' in chosen) return setMessage(chosen.error);
        body = { startDate, endDate, cadence, ...chosen.focus };
      }
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      setNotes((data.skipped as Skipped[] | undefined) ?? []);
      if (res.status === 201) {
        const ids = (data.runs as Run[]).map((r) => r.id);
        const record: Started = editing
          ? { runIds: ids, startDate, endDate, cadence, criteriaLabel: picker.label, edited: true }
          : { runIds: ids, startDate: plan.startDate, endDate: plan.endDate, cadence: plan.cadence, criteriaLabel: criteria, edited: false };
        setStarted(record.edited ? editedView(record) : null);
        setEditing(false);
        setRunIds(ids);
        runsChanged();
        // Best effort: without it a reload falls back to matching the planned gaps.
        void fetch(`/api/chat-sessions/${sessionId}/fetch-plan`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toolCallId, ...record }),
        }).catch(() => {});
      } else if (res.status === 409) setMessage('Those dates are already fetched with these search criteria.');
      else setMessage(data.error ?? 'Could not start the fetch.');
    } finally {
      setPending(false);
    }
  }

  // Asks the plan's question once its runs are done, unless the owner already wrote something after the card.
  function allDone(runs: Run[]) {
    const ask = plan.followUpQuestion && !laterUserMessage;
    const asked = ask ? onRunsDone(runs.map((r) => r.id), plan.followUpQuestion) : false;
    setResult({ mentions: runs.reduce((n, r) => n + r.mentionCount, 0), asked });
  }

  return (
    <section className="w-full overflow-hidden rounded-md border border-border text-sm" data-testid="fetch-plan-card">
      <header className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">
        Fetch plan · {plan.subjectName}
      </header>
      <div className="flex flex-col gap-xs px-sm py-sm">
        {editing ? (
          <div className="flex flex-col gap-sm" data-testid="fetch-plan-edit">
            <div className="flex flex-wrap items-end gap-sm">
              <DateField label="Start" id={`${uid}-start`} name="startDate" defaultValue={startDate} max={endDate} onChange={setStartDate} />
              <DateField label="End" id={`${uid}-end`} name="endDate" defaultValue={endDate} min={startDate} max={isoDaysAgo(0)} onChange={setEndDate} />
              <label className="flex flex-col justify-between gap-xs self-stretch text-sm font-medium">
                Cadence
                <select
                  value={cadence}
                  onChange={(e) => setCadence(e.target.value as Cadence)}
                  className={pickerFieldClass}
                  data-testid="plan-cadence"
                >
                  <option value="daily">daily</option>
                  <option value="weekly">weekly</option>
                  <option value="monthly">monthly</option>
                </select>
              </label>
            </div>
            <SearchCriteriaPicker state={picker} testId="plan-criteria" />
          </div>
        ) : (
          <>
            <p className="font-medium" data-testid="fetch-plan-range">
              {started
                ? `${rangeWithYear(started)} · ${started.cadence}`
                : `${rangeWithYear({ start: plan.startDate, end: plan.endDate })} · ${plan.cadence}`}
            </p>
            <p className="font-medium">
              Search criteria:{' '}
              {started ? (
                <span className="font-normal" title={started.criteria}>
                  {started.criteria.length > 80 ? `${started.criteria.slice(0, 80)}…` : started.criteria}
                </span>
              ) : (
                <span className="font-normal" title={plan.instructions ?? undefined}>
                  {criteria.length > 80 ? `${criteria.slice(0, 80)}…` : criteria}
                </span>
              )}
            </p>
            {/* The plan's gaps and skipped ranges describe the unedited plan only. */}
            {!started &&
              !notes &&
              plan.skipped.map((s) => (
                <p key={`${s.runId}-${s.start}`} className="text-muted-foreground">
                  Already fetched: {formatRange(s)} (run #{s.runId}, {s.status})
                </p>
              ))}
            {!started &&
              (plan.gaps.length === 0 ? (
                <p className="font-medium">Nothing new to fetch.</p>
              ) : (
                <>
                  {plan.gaps.map((g) => (
                    <p key={g.start}>
                      To fetch: {formatRange(g)} ({windowsLabel(g.windows)})
                    </p>
                  ))}
                  <p className="text-muted-foreground">
                    Total: {plan.totalWindows} web-search {plan.totalWindows === 1 ? 'window' : 'windows'}
                  </p>
                </>
              ))}
          </>
        )}

        {notes?.map((s) => (
          <p key={`${s.runId}-${s.start}`} className="text-muted-foreground">
            Skipped {formatRange(s)} (already fetched in run #{s.runId}).
          </p>
        ))}

        {runIds ? (
          <>
            <FetchRunProgress subjectId={plan.subjectId} runIds={runIds} onAllDone={allDone} />
            {result ? (
              <p className="font-medium" data-testid="fetch-plan-done">
                Done: {plural(result.mentions, 'mention')}.{' '}
                {result.asked ? 'Your question was sent below.' : 'Ask a question below.'}
              </p>
            ) : (
              plan.followUpQuestion &&
              !laterUserMessage && (
                <p className="text-muted-foreground">
                  We&apos;ll ask &ldquo;{plan.followUpQuestion}&rdquo; once the fetch finishes.
                </p>
              )
            )}
          </>
        ) : (
          (checked || plan.gaps.length === 0) && (
            <>
              {plan.followUpQuestion && !laterUserMessage && (editing || plan.gaps.length > 0) && (
                <p className="text-muted-foreground" data-testid="fetch-plan-followup">
                  After the fetch we&apos;ll ask: &ldquo;{plan.followUpQuestion}&rdquo;
                </p>
              )}
              <div className="flex flex-wrap items-center gap-sm sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditing((e) => !e)}
                  className={linkClass}
                  data-testid="fetch-plan-edit-toggle"
                >
                  {editing ? 'Cancel edit' : 'Edit'}
                </button>
                <Button
                  type="button"
                  onClick={start}
                  disabled={pending || (editing ? !picker.ready : plan.gaps.length === 0)}
                  className="w-full sm:w-auto"
                >
                  {pending ? 'Starting…' : 'Start fetch'}
                </Button>
              </div>
              {message && (
                <p role="alert" className="text-destructive">
                  {message}
                </p>
              )}
            </>
          )
        )}
      </div>
    </section>
  );
}
