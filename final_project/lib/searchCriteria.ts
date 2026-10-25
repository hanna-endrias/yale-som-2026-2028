import { z } from 'zod';

// Structured "search criteria" for a fetch. Saved on prompts.criteria (kind 'fetch'); the rendered text
// (criteriaToInstructions) is what goes to prompts.body, fetch_runs.instructions and the fetcher's OWNER FOCUS
// block, so the no-overlap rule keeps comparing plain text. Client-safe: no server imports.

export const SOURCES = ['news', 'reviews', 'forums', 'social', 'youtube', 'blogs'] as const;
export type Source = (typeof SOURCES)[number];
export const SOURCE_LABEL: Record<Source, string> = {
  news: 'News',
  reviews: 'Reviews',
  forums: 'Reddit/forums',
  social: 'Social',
  youtube: 'YouTube',
  blogs: 'Blogs',
};

// Caps keep the rendered text under the 2000-character instructions limit.
const MAX_TERMS = 8;
const term = z.string().trim().max(40, { error: 'Keep each topic or keyword to 40 characters.' });

// Every field is optional; empty means no constraint. No transforms, so it also works as a tool input schema.
export const searchCriteriaSchema = z.object({
  sources: z.array(z.enum(SOURCES, { error: 'Unknown source.' })).max(SOURCES.length).optional(),
  topics: z.array(term).max(MAX_TERMS, { error: `Keep topics to ${MAX_TERMS}.` }).optional(),
  excludeKeywords: z.array(term).max(MAX_TERMS, { error: `Keep excluded keywords to ${MAX_TERMS}.` }).optional(),
  region: z.string().trim().max(60, { error: 'Keep the region to 60 characters.' }).optional(),
  language: z.string().trim().max(40, { error: 'Keep the language to 40 characters.' }).optional(),
  notes: z.string().trim().max(1000, { error: 'Keep the notes to 1000 characters.' }).optional(),
});

export type SearchCriteriaInput = z.infer<typeof searchCriteriaSchema>;
export type SearchCriteria = Required<SearchCriteriaInput>;

export const EMPTY_CRITERIA: SearchCriteria = { sources: [], topics: [], excludeKeywords: [], region: '', language: '', notes: '' };

const terms = (list: string[] = []) => [...new Set(list.map((t) => t.trim()).filter(Boolean))];

// Fills missing fields, trims, drops blanks and duplicates, and orders sources like SOURCES.
export function normalizeCriteria(c: SearchCriteriaInput | null | undefined): SearchCriteria {
  return {
    sources: SOURCES.filter((s) => c?.sources?.includes(s)),
    topics: terms(c?.topics),
    excludeKeywords: terms(c?.excludeKeywords),
    region: c?.region?.trim() ?? '',
    language: c?.language?.trim() ?? '',
    notes: c?.notes?.trim() ?? '',
  };
}

export const isEmptyCriteria = (c: SearchCriteriaInput | null | undefined) => criteriaToInstructions(c) === '';

// Stable, ordered text, one line per filled field. Empty criteria -> ''.
export function criteriaToInstructions(input: SearchCriteriaInput | null | undefined): string {
  const c = normalizeCriteria(input);
  return [
    c.sources.length && `Sources: ${c.sources.map((s) => (s === 'forums' ? 'Reddit/forums' : SOURCE_LABEL[s].toLowerCase())).join(', ')}`,
    c.topics.length && `Focus topics: ${c.topics.join(', ')}`,
    c.excludeKeywords.length && `Exclude results mentioning: ${c.excludeKeywords.join(', ')}`,
    c.region && `Region: ${c.region}`,
    c.language && `Language: ${c.language}`,
    c.notes && `Notes: ${c.notes}`,
  ]
    .filter(Boolean)
    .join('\n');
}

// One line, e.g. "Reviews, Reddit/forums · pricing · US". Empty criteria -> ''.
export function criteriaSummary(input: SearchCriteriaInput | null | undefined): string {
  const c = normalizeCriteria(input);
  return [
    c.sources.map((s) => SOURCE_LABEL[s]).join(', '),
    c.topics.join(', '),
    c.excludeKeywords.length && `not ${c.excludeKeywords.join(', ')}`,
    c.region,
    c.language,
    !c.sources.length && !c.topics.length && c.notes && (c.notes.length > 60 ? `${c.notes.slice(0, 60)}…` : c.notes),
  ]
    .filter(Boolean)
    .join(' · ');
}

// Parses a stored prompts.criteria JSON value; null when missing or invalid (legacy rows).
export function parseStoredCriteria(json: string | null): SearchCriteria | null {
  if (!json) return null;
  try {
    const parsed = searchCriteriaSchema.safeParse(JSON.parse(json));
    return parsed.success ? normalizeCriteria(parsed.data) : null;
  } catch {
    return null;
  }
}

// Criteria to edit for a saved search criteria: its structured fields, or a legacy row's text as Notes.
export const criteriaForEditing = (p: { criteria: SearchCriteria | null; body: string }): SearchCriteria =>
  p.criteria ?? { ...EMPTY_CRITERIA, notes: p.body };
