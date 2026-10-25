'use client';

import { MessageSquarePlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatRangeWithYear } from '@/lib/dateRanges';
import type { TrackerOverview } from '@/services/subjectService';

const SENTIMENTS = [
  { key: 'positive', label: 'positive', color: 'var(--brand-chart-positive)' },
  { key: 'neutral', label: 'neutral', color: 'var(--brand-chart-neutral)' },
  { key: 'negative', label: 'negative', color: 'var(--brand-color-destructive)' },
] as const;

const linkClass =
  'rounded-md bg-button px-md py-xs text-sm font-medium text-on-button hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-focus';
const secondaryClass =
  'flex items-center gap-xs rounded-md border border-border px-md py-xs text-sm font-medium hover:bg-background focus-visible:outline-2 focus-visible:outline-focus';

// Whole percentages that sum to 100 (largest remainder), so the legend never reads 101%.
function percents(counts: number[], total: number): number[] {
  const exact = counts.map((c) => (c / total) * 100);
  const result = exact.map((x) => Math.floor(x));
  const left = 100 - result.reduce((a, b) => a + b, 0);
  const order = exact.map((_, i) => i).sort((a, b) => (exact[b] % 1) - (exact[a] % 1));
  for (let k = 0; k < left; k++) result[order[k]]++;
  return result;
}

// /chat home: one card per tracker with what's stored (mentions, sentiment split, dates fetched, spend).
export default function TrackerCards({ trackers }: { trackers: TrackerOverview[] }) {
  const router = useRouter();

  async function newChat(subjectId: number) {
    const res = await fetch(`/api/subjects/${subjectId}/chat-sessions`, { method: 'POST' });
    if (!res.ok) return;
    const { session } = await res.json();
    router.push(`/chat/${session.id}`);
    router.refresh();
  }

  return (
    <ul className="grid w-full max-w-3xl gap-md sm:grid-cols-2" data-testid="tracker-cards">
      {trackers.map((t) => {
        const total = t.sentiment.positive + t.sentiment.neutral + t.sentiment.negative;
        const pct = total > 0 ? percents(SENTIMENTS.map((s) => t.sentiment[s.key]), total) : [];
        return (
          <li key={t.id} className="flex flex-col gap-sm rounded-lg border border-border bg-panel p-md text-left">
            <h2 className="font-heading text-lg font-bold">{t.name}</h2>
            <p className="text-sm text-muted-foreground">
              {total === 0
                ? 'No mentions fetched yet'
                : `${total} ${total === 1 ? 'mention' : 'mentions'} · ${formatRangeWithYear(t.fetched!)}`}
            </p>
            {total > 0 && (
              <>
                <div
                  className="flex h-2 overflow-hidden rounded-full bg-background"
                  role="img"
                  aria-label={SENTIMENTS.map((s) => `${t.sentiment[s.key]} ${s.label}`).join(', ')}
                >
                  {SENTIMENTS.map((s) => (
                    <span key={s.key} style={{ width: `${(t.sentiment[s.key] / total) * 100}%`, background: s.color }} />
                  ))}
                </div>
                <ul className="flex flex-wrap gap-x-md text-xs text-muted-foreground" aria-hidden>
                  {SENTIMENTS.map((s, i) => (
                    <li key={s.key} className="flex items-center gap-xs">
                      <span className="size-2 rounded-full" style={{ background: s.color }} />
                      {pct[i]}% {s.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {t.costUsd > 0 && <p className="text-xs text-muted-foreground">~${t.costUsd.toFixed(2)} spent so far (estimated)</p>}
            <div className="mt-auto flex flex-wrap gap-sm pt-xs">
              {t.latestSessionId && (
                <Link href={`/chat/${t.latestSessionId}`} className={linkClass}>
                  Open latest chat
                </Link>
              )}
              <button
                type="button"
                onClick={() => newChat(t.id)}
                className={t.latestSessionId ? secondaryClass : `flex items-center gap-xs ${linkClass}`}
              >
                <MessageSquarePlus className="size-4" aria-hidden /> New chat
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
