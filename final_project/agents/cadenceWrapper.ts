import { fetchWindow, type FetchSubject, type FetchWindowResult, type Window } from './fetchAgent';

export type Cadence = 'daily' | 'weekly' | 'monthly';

const DAY_MS = 86_400_000;
const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().slice(0, 10);

// Adds k calendar months in UTC, clamped to the target month's last day (Jan 31 + 1 month → Feb 28).
const addMonths = (d: Date, k: number) => {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + k;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d.getUTCDate(), lastDay)));
};

// Splits [start, end] (inclusive, YYYY-MM-DD) into 1-day, 7-day or calendar-month windows; the last one may be shorter.
// A monthly window ends the day before the same day-of-month next month (Aug 15 → Sep 14). Window k starts k months
// after the ORIGINAL start, so a Jan 31 start gives Feb 28, then Mar 31, and never skips a month.
export function splitWindows(start: string, end: string, cadence: Cadence): Window[] {
  const first = toDate(start);
  const last = toDate(end).getTime();
  const startOf = (k: number) =>
    cadence === 'monthly' ? addMonths(first, k).getTime() : first.getTime() + k * (cadence === 'weekly' ? 7 : 1) * DAY_MS;
  const out: Window[] = [];
  for (let k = 0; startOf(k) <= last; k++) {
    out.push({ start: toIso(new Date(startOf(k))), end: toIso(new Date(Math.min(startOf(k + 1) - DAY_MS, last))) });
  }
  return out;
}

// Runs the Fetch Agent once per window, in order, handing each result to onWindow.
// `instructions` (the owner's focus prompt) is added to every window's system prompt.
export async function runCadence(
  subject: FetchSubject,
  input: { startDate: string; endDate: string; cadence: Cadence; instructions?: string },
  onWindow: (result: FetchWindowResult) => void,
) {
  for (const window of splitWindows(input.startDate, input.endDate, input.cadence)) {
    onWindow(await fetchWindow(subject, window, input.instructions));
  }
}
