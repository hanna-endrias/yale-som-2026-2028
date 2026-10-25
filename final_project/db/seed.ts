import { hashPassword } from '@/lib/auth';
import { seedDefaultPrompts } from '@/services/promptService';
import type { Db } from './client';
import { insertSubject, listFixtures, readFixture } from './fixtures';
import { users } from './schema';

// Two test owners, then every saved subject in db/fixtures/subjects/ (alphabetical, so ids are stable).
// Fixtures are real fetch runs and chats saved by `npm run fixture:save`, so a fresh start spends no tokens.
export function seed(db: Db): void {
  db.transaction((tx) => {
    const owners = new Map<string, number>();
    for (const email of ['owner1@test.com', 'owner2@test.com']) {
      const user = tx.insert(users).values({ email, passwordHash: hashPassword('test1234') }).returning().get();
      seedDefaultPrompts(tx, user.id);
      owners.set(email, user.id);
    }

    for (const slug of listFixtures()) {
      const fixture = readFixture(slug);
      let ownerId = owners.get(fixture.owner);
      if (ownerId === undefined) {
        console.warn(`[seed] ${slug}: owner ${fixture.owner} is not a test user, seeding under owner1@test.com`);
        ownerId = owners.get('owner1@test.com')!;
      }
      insertSubject(tx, ownerId, fixture);
    }
  });
}
