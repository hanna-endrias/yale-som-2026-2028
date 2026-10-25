import { sql } from 'drizzle-orm';
import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const id = () => integer('id').primaryKey({ autoIncrement: true });
const createdAt = () => text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const users = sqliteTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const subjects = sqliteTable('subjects', {
  id: id(),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  location: text('location'),
  website: text('website'),
  searchTerms: text('search_terms').notNull().default(''),
  createdAt: createdAt(),
});

export const fetchRuns = sqliteTable('fetch_runs', {
  id: id(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  cadence: text('cadence').notNull(),
  status: text('status', { enum: ['pending', 'running', 'done', 'failed'] }).notNull().default('pending'),
  error: text('error'), // set when status is `failed`
  instructions: text('instructions'), // snapshot of the fetcher prompt used, if any
  createdAt: createdAt(),
});

export const mentions = sqliteTable('mentions', {
  id: id(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  fetchRunId: integer('fetch_run_id').notNull().references(() => fetchRuns.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  url: text('url').notNull(),
  snippet: text('snippet').notNull(),
  publishedAt: text('published_at').notNull(),
  sentiment: text('sentiment', { enum: ['positive', 'neutral', 'negative'] }).notNull(),
  rawTokens: integer('raw_tokens').notNull().default(0),
  // Detail fields; null on mentions stored before they existed.
  title: text('title'),
  summary: text('summary'), // 2-4 sentences: what is said and why
  quote: text('quote'), // verbatim excerpt, when the search result showed one
  themes: text('themes'), // comma-separated, lowercase
  authorType: text('author_type', { enum: ['press', 'social', 'forum', 'review', 'brand', 'other'] }),
});

export const chatSessions = sqliteTable('chat_sessions', {
  id: id(),
  subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title'),
  createdAt: createdAt(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: id(),
  chatSessionId: integer('chat_session_id')
    .notNull()
    .references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'tool'] }).notNull(),
  content: text('content').notNull(),
  payload: text('payload'), // JSON tool output kept for replay (createVisualization's { title, html })
  createdAt: createdAt(),
});

// Library prompt. Available on a subject when all_subjects is set or a prompt_subjects row exists.
export const prompts = sqliteTable('prompts', {
  id: id(),
  ownerId: integer('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: ['analyst', 'fetch'] }).notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  allSubjects: integer('all_subjects', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
});

export const promptSubjects = sqliteTable(
  'prompt_subjects',
  {
    promptId: integer('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
    subjectId: integer('subject_id').notNull().references(() => subjects.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.promptId, t.subjectId] })],
);

// ref_id points at a fetch_run or a chat_message depending on scope, so it has no FK.
export const tokenUsage = sqliteTable('token_usage', {
  id: id(),
  scope: text('scope', { enum: ['fetch_run', 'chat_turn'] }).notNull(),
  refId: integer('ref_id').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cachedTokens: integer('cached_tokens').notNull().default(0),
  estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
  createdAt: createdAt(),
});
