import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCadence, splitWindows, type Cadence } from '@/agents/cadenceWrapper';
import type { FetchSubject, FetchWindowResult } from '@/agents/fetchAgent';

// Runs ONE real fetch (spends tokens) and saves it as a seed fixture, so db/seed.ts can load
// real mentions without calling the LLM on every fresh start.
// Usage: npm run fixture:capture -- [startDate endDate]   (defaults to the full range below)

const FIXTURE = {
  name: 'friend',
  subject: {
    name: 'Friend',
    description:
      'Friend, the AI companion pendant by Avi Schiffmann. Its September–October 2025 New York City subway ad campaign drew wide backlash and was widely defaced.',
    location: 'New York City subway (ad campaign)',
    website: 'https://friend.com',
    searchTerms: 'Friend pendant, friend.com, Avi Schiffmann, Friend AI necklace, Friend subway ads',
  } satisfies FetchSubject,
  run: {
    startDate: '2025-09-01',
    endDate: '2025-11-23',
    cadence: 'weekly' as Cadence,
    instructions:
      'Cover the whole conversation: news coverage, reviews of the device, Reddit and X reactions, and commentary on the subway ad campaign and its vandalism. Include positive takes when you find them, not just criticism.',
  },
};

async function main() {
  const [start, end] = process.argv.slice(2);
  const run = { ...FIXTURE.run, startDate: start ?? FIXTURE.run.startDate, endDate: end ?? FIXTURE.run.endDate };
  const windows: (FetchWindowResult & { start: string; end: string })[] = [];
  let i = 0;
  const plan = splitWindows(run.startDate, run.endDate, run.cadence);
  await runCadence(FIXTURE.subject, run, (result) => {
    const w = plan[i++];
    windows.push({ ...w, ...result });
    console.log(
      `${w.start} → ${w.end}: ${result.mentions.length} mentions, ` +
        `${result.usage.inputTokens ?? 0} in / ${result.usage.outputTokens ?? 0} out tokens`,
    );
  });

  const file = path.resolve(process.cwd(), 'db/fixtures', `${FIXTURE.name}.json`);
  mkdirSync(path.dirname(file), { recursive: true });
  const usage = (u: FetchWindowResult['usage']) => ({
    inputTokens: u.inputTokens ?? 0,
    outputTokens: u.outputTokens ?? 0,
    cachedTokens: u.inputTokenDetails?.cacheReadTokens ?? 0,
  });
  const out = {
    capturedAt: new Date().toISOString(),
    subject: FIXTURE.subject,
    run,
    windows: windows.map((w) => ({ start: w.start, end: w.end, usage: usage(w.usage), mentions: w.mentions })),
  };
  writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
  const total = out.windows.reduce((n, w) => n + w.mentions.length, 0);
  const tokens = out.windows.reduce((n, w) => n + w.usage.inputTokens + w.usage.outputTokens, 0);
  console.log(`Wrote ${file}: ${out.windows.length} windows, ${total} mentions, ${tokens.toLocaleString('en-US')} tokens`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
