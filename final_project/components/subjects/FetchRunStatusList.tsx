'use client';

import { useEffect, useState } from 'react';
import TokenCostBadge from '@/components/common/TokenCostBadge';

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

const POLL_MS = 3000;
const statusClass = { pending: 'text-muted-foreground', running: 'text-accent-text', done: 'text-text', failed: 'text-destructive' };

// SubjectModal › Fetch runs: run history. Polls every 3 s while any run is pending or running.
// `refreshKey` changes when a new run is started, so the list reloads right away.
export default function FetchRunStatusList({ subjectId, refreshKey }: { subjectId: number; refreshKey: number }) {
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/subjects/${subjectId}/fetch-runs`);
      const data = await res.json();
      if (cancelled) return;
      if (!res.ok) return setError(data.error ?? 'Could not load fetch runs.');
      setRuns(data.runs);
      if (data.runs.some((r: Run) => r.status === 'pending' || r.status === 'running')) timer = setTimeout(load, POLL_MS);
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subjectId, refreshKey]);

  return (
    <section className="flex flex-col gap-sm">
      <h3 className="font-heading font-semibold">Fetch history</h3>
      {!runs ? (
        <p className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || 'Loading…'}</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No fetch runs yet.</p>
      ) : (
        <ul className="flex max-h-72 flex-col overflow-y-auto rounded-md border border-border">
          {runs.map((r) => (
            <li key={r.id} className="flex flex-col gap-xs border-b border-border px-md py-sm text-sm last:border-b-0">
              <div className="flex flex-wrap items-center gap-x-md gap-y-xs">
                <span className="font-medium">
                  {r.startDate} → {r.endDate}
                </span>
                <span className="text-muted-foreground">{r.cadence}</span>
                <span className={`font-medium ${statusClass[r.status]}`}>
                  {r.status === 'running' || r.status === 'pending' ? `${r.status}…` : r.status}
                </span>
                <span className="ml-auto">
                  {r.mentionCount} {r.mentionCount === 1 ? 'mention' : 'mentions'}
                </span>
                {r.tokens > 0 && <TokenCostBadge tokens={r.tokens} costUsd={r.costUsd} />}
              </div>
              {r.instructions && (
                <p title={r.instructions} className="line-clamp-1 wrap-anywhere text-xs text-muted-foreground">
                  &ldquo;{r.instructions}&rdquo;
                </p>
              )}
              {r.status === 'failed' && r.error && <p className="text-xs text-destructive">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
