'use client';

import { useEffect, useRef, useState } from 'react';
import TokenCostBadge from '@/components/common/TokenCostBadge';
import { formatRange } from '@/lib/dateRanges';

// One row of GET /api/subjects/:id/fetch-runs.
export type Run = {
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

type Props = {
  subjectId: number;
  runIds: number[];
  onAllDone?: (runs: Run[]) => void; // once, when every run is done (not when one failed)
};

export const POLL_MS = 3000;
export const statusClass = {
  pending: 'text-muted-foreground',
  running: 'text-accent-text',
  done: 'text-text',
  failed: 'text-destructive',
};
export const statusLabel = (s: Run['status']) => (s === 'running' || s === 'pending' ? `${s}…` : s);

// Live status of started fetch runs: polls every 3 s while any is pending or running.
export default function FetchRunProgress({ subjectId, runIds, onAllDone }: Props) {
  const [runs, setRuns] = useState<Run[]>([]);
  const ids = runIds.join(',');
  // Latest callback without restarting the poll; `fired` keeps it to one call.
  const done = useRef(onAllDone);
  done.current = onAllDone;
  const fired = useRef(false);

  useEffect(() => {
    const wanted = ids.split(',').map(Number);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/subjects/${subjectId}/fetch-runs`);
      if (cancelled || !res.ok) return;
      const mine = ((await res.json()).runs as Run[]).filter((r) => wanted.includes(r.id));
      if (cancelled) return;
      setRuns(mine);
      if (mine.some((r) => r.status === 'pending' || r.status === 'running')) timer = setTimeout(load, POLL_MS);
      else if (mine.length === wanted.length && mine.every((r) => r.status === 'done') && !fired.current) {
        fired.current = true;
        done.current?.(mine);
      }
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subjectId, ids]);

  return (
    <ul className="flex flex-col rounded-md border border-border" data-testid="fetch-run-progress">
      {runs.length === 0 && <li className="px-sm py-xs text-muted-foreground">Starting…</li>}
      {runs.map((r) => (
        <li key={r.id} className="flex flex-col gap-xs border-b border-border px-sm py-xs last:border-b-0">
          <div className="flex flex-wrap items-center gap-x-md gap-y-xs">
            <span className="font-medium">
              Run #{r.id} · {formatRange({ start: r.startDate, end: r.endDate })}
            </span>
            <span className={`font-medium ${statusClass[r.status]}`} data-testid="fetch-run-status">
              {statusLabel(r.status)}
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
  );
}
