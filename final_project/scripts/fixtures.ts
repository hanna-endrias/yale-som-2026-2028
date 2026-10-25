import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { asc, count, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { exportSubject, FIXTURES_DIR, fixturePath, listFixtures, readFixture, removeSubject, slugify } from '@/db/fixtures';
import { chatSessions, mentions, subjects, users } from '@/db/schema';

// Saved seed data (db/fixtures/subjects/*.json). Costs nothing: no LLM calls.
//   npm run fixture:list                              saved fixtures and live DB subjects
//   npm run fixture:save -- <subjectId> [--name slug] save a live subject (overwrites the same slug)
//   npm run fixture:remove -- <slug> [<slug> ...]     delete the file and that subject from the live DB

const [command, ...args] = process.argv.slice(2);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function list() {
  const db = getDb();
  const saved = listFixtures().map((slug) => ({ slug, f: readFixture(slug) }));
  console.log(`Saved fixtures (${FIXTURES_DIR}):`);
  if (!saved.length) console.log('  (none)');
  for (const { slug, f } of saved) {
    const n = f.runs.reduce((k, r) => k + r.mentions.length, 0);
    console.log(`  ${slug.padEnd(24)} "${f.subject.name}" (${f.owner}): ${f.runs.length} runs, ${n} mentions, ${f.chats.length} chats`);
  }

  const live = db
    .select({ id: subjects.id, name: subjects.name, owner: users.email })
    .from(subjects)
    .innerJoin(users, eq(users.id, subjects.ownerId))
    .orderBy(asc(subjects.id))
    .all();
  console.log('\nLive DB subjects:');
  if (!live.length) console.log('  (none)');
  for (const s of live) {
    const n = db.select({ n: count() }).from(mentions).where(eq(mentions.subjectId, s.id)).get()?.n ?? 0;
    const chats = db.select({ n: count() }).from(chatSessions).where(eq(chatSessions.subjectId, s.id)).get()?.n ?? 0;
    const isSaved = saved.find(({ f }) => f.owner === s.owner && f.subject.name === s.name);
    console.log(
      `  id ${String(s.id).padEnd(4)} "${s.name}" (${s.owner}): ${n} mentions, ${chats} chats` +
        (isSaved ? `  [saved as ${isSaved.slug}]` : '  [not saved]'),
    );
  }
}

function save() {
  const subjectId = Number(args[0]);
  if (!Number.isInteger(subjectId)) fail('Usage: npm run fixture:save -- <subjectId> [--name slug]');
  const nameAt = args.indexOf('--name');
  const result = exportSubject(getDb(), subjectId);
  if (!result) fail(`No subject ${subjectId}. Run npm run fixture:list to see ids.`);
  const { fixture, skippedRuns } = result;
  const slug = nameAt >= 0 ? slugify(args[nameAt + 1] ?? '') : slugify(fixture.subject.name);
  if (!slug) fail('Empty fixture name.');

  mkdirSync(FIXTURES_DIR, { recursive: true });
  writeFileSync(fixturePath(slug), JSON.stringify(fixture, null, 2) + '\n');
  const n = fixture.runs.reduce((k, r) => k + r.mentions.length, 0);
  console.log(
    `Wrote ${fixturePath(slug)}: "${fixture.subject.name}" (${fixture.owner}), ${fixture.runs.length} runs, ` +
      `${n} mentions, ${fixture.prompts.length} prompts, ${fixture.chats.length} chats`,
  );
  if (skippedRuns) console.log(`Skipped ${skippedRuns} run(s) that are not done (pending, running or failed).`);
}

function remove() {
  if (!args.length) fail('Usage: npm run fixture:remove -- <slug> [<slug> ...]');
  const saved = new Set(listFixtures());
  for (const slug of args) if (!saved.has(slug)) fail(`No fixture "${slug}". Saved: ${[...saved].join(', ') || '(none)'}`);
  const db = getDb();
  for (const slug of args) {
    const { owner, subject } = readFixture(slug);
    rmSync(fixturePath(slug));
    const deleted = removeSubject(db, owner, subject.name);
    console.log(`Removed ${slug}: deleted the file and ${deleted} matching subject(s) "${subject.name}" (${owner}) from the live DB`);
  }
}

if (command === 'list') list();
else if (command === 'save') save();
else if (command === 'remove') remove();
else fail('Usage: tsx scripts/fixtures.ts list | save <subjectId> [--name slug] | remove <slug...>');
