'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import TokenCostBadge from '@/components/common/TokenCostBadge';
import { formatRange } from '@/lib/dateRanges';

// The planFetchRun tool's output (agents/tools/planFetchRun.ts).
export type FetchPlan = {
  subjectId: number;
  subjectName: string;
  startDate: string;
  endDate: string;
  cadence: 'daily' | 'weekly' | 'monthly';
  promptTitle?: string;
  instructions: string | null;
  gaps: { start: string; end: string; windows: number }[];
  skipped: { start: string; end: string; runId: number; status: string }[];
  totalWindows: number;
};

type Run = {
  id: number;
  startDate: string;
  endDate: string;
  cadence: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  error: string | null;
  instructions: string | null;
  mentionCount: number;
  tokens: number;
  costUsd: number;
};

export const isFetchPlan = (o: unknown): o is FetchPlan =>
  typeof o === 'object' && o !== null && Array.isArray((o as { gaps?: unknown }).gaps);

const POLL_MS = 3000;
const statusClass = { pending: 'text-muted-foreground', running: 'text-accent-text', done: 'text-text', failed: 'text-destructive' };
const windowsLabel = (n: number) => `${n} ${n === 1 ? 'window' : 'windows'}`;

// Chat card for a planned fetch: shows the gaps and a Start button (the only way a chat fetch starts),
// then the started runs' live status. On reload it finds its runs by matching each gap in the run history.
export default function FetchPlanCard({ plan }: { plan: FetchPlan }) {
  const [runIds, setRunIds] = useState<number[] | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const url = `/api/subjects/${plan.subjectId}/fetch-runs`;
  const prompt = plan.promptTitle ?? (plan.instructions ? `“${plan.instructions}”` : 'None');

  // On mount: were this plan's gaps already started (e.g. before a reload)?
  useEffect(() => {
    if (!plan.gaps.length) return;
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

  // Poll the started runs until each is done or failed.
  useEffect(() => {
    if (!runIds) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function load() {
      const res = await fetch(url);
      if (cancelled || !res.ok) return;
      const mine = ((await res.json()).runs as Run[]).filter((r) => runIds!.includes(r.id));
      if (cancelled) return;
      setRuns(mine);
      if (mine.some((r) => r.status === 'pending' || r.status === 'running')) timer = setTimeout(load, POLL_MS);
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [url, runIds]);

  async function start() {
    setPending(true);
    setMessage('');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startDate: plan.startDate,
        endDate: plan.endDate,
        cadence: plan.cadence,
        instructions: plan.instructions ?? undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPending(false);
    if (res.status === 201) setRunIds((data.runs as Run[]).map((r) => r.id));
    else if (res.status === 409) setMessage('Already fetched.');
    else setMessage(data.error ?? 'Could not start the fetch.');
  }

  return (
    <section className="w-full overflow-hidden rounded-md border border-border text-sm" data-testid="fetch-plan-card">
      <header className="border-b border-border bg-panel px-sm py-xs text-xs font-semibold">
        Fetch plan · {plan.subjectName}
      </header>
      <div className="flex flex-col gap-xs px-sm py-sm">
        <p className="font-medium">
          {formatRange({ start: plan.startDate, end: plan.endDate })} · {plan.cadence} · prompt:{' '}
          <span className="font-normal" title={plan.instructions ?? undefined}>
            {prompt.length > 80 ? `${prompt.slice(0, 80)}…` : prompt}
          </span>
        </p>
        {plan.skipped.map((s) => (
          <p key={`${s.runId}-${s.start}`} className="text-muted-foreground">
            Already fetched: {formatRange(s)} (run #{s.runId}, {s.status})
          </p>
        ))}
        {plan.gaps.length === 0 ? (
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
        )}

        {runIds ? (
          <ul className="flex flex-col rounded-md border border-border" data-testid="fetch-plan-runs">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-col gap-xs border-b border-border px-sm py-xs last:border-b-0">
                <div className="flex flex-wrap items-center gap-x-md gap-y-xs">
                  <span className="font-medium">
                    Run #{r.id} · {formatRange({ start: r.startDate, end: r.endDate })}
                  </span>
                  <span className={`font-medium ${statusClass[r.status]}`} data-testid="fetch-plan-status">
                    {r.status === 'running' || r.status === 'pending' ? `${r.status}…` : r.status}
                  </span>
                  <span className="sm:ml-auto">
                    {r.mentionCount} {r.mentionCount === 1 ? 'mention' : 'mentions'}
                  </span>
                  {r.tokens > 0 && <TokenCostBadge tokens={r.tokens} costUsd={r.costUsd} />}
                </div>
                {r.status === 'failed' && r.error && <p className="text-xs text-destructive">{r.error}</p>}
              </li>
            ))}
          </ul>
        ) : (
          plan.gaps.length > 0 &&
          checked && (
            <div className="flex flex-col gap-xs sm:items-end">
              <Button type="button" onClick={start} disabled={pending || message === 'Already fetched.'} className="w-full sm:w-auto">
                {pending ? 'Starting…' : 'Start fetch'}
              </Button>
              {message && <p className="text-muted-foreground">{message}</p>}
            </div>
          )
        )}
      </div>
    </section>
  );
}
