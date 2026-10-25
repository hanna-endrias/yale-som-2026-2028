// Pure date-range helpers on inclusive YYYY-MM-DD dates (UTC day math, like agents/cadenceWrapper.ts).
// Client-safe: no server imports.

export type DateRange = { start: string; end: string };

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);

// The overlap of a and b, or null when they don't touch.
export function intersectRange(a: DateRange, b: DateRange): DateRange | null {
  const start = a.start > b.start ? a.start : b.start;
  const end = a.end < b.end ? a.end : b.end;
  return start <= end ? { start, end } : null;
}

// The parts of `range` not covered by any of `covered`, as contiguous ranges in date order.
export function subtractRanges(range: DateRange, covered: DateRange[]): DateRange[] {
  const parts = covered
    .map((c) => intersectRange(range, c))
    .filter((c): c is DateRange => c !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
  const gaps: DateRange[] = [];
  let cursor = range.start;
  for (const c of parts) {
    if (c.start > cursor) gaps.push({ start: cursor, end: shift(c.start, -1) });
    const next = shift(c.end, 1);
    if (next > cursor) cursor = next;
  }
  if (cursor <= range.end) gaps.push({ start: cursor, end: range.end });
  return gaps;
}

// "Mar 1–Mar 20" (UTC).
export function formatRange({ start, end }: DateRange): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${fmt(start)}–${fmt(end)}`;
}

// "Sep 1–Nov 23, 2025", or "Sep 1, 2025–Mar 31, 2026" when the range spans years.
export function formatRangeWithYear(range: DateRange): string {
  const [startYear, endYear] = [range.start.slice(0, 4), range.end.slice(0, 4)];
  if (startYear === endYear) return `${formatRange(range)}, ${endYear}`;
  const [start, end] = formatRange(range).split('–');
  return `${start}, ${startYear}–${end}, ${endYear}`;
}
