import { INJECTION_RULES } from '@/lib/safety';
import type { FetchSubject } from '@/agents/fetchAgent';

const FETCHER_BASE = `You are the Fetch Agent. Use web search to find online mentions (reviews, articles, social posts, forum threads) of the given subject.
Only return mentions you actually found in search results, with their real URL; never invent any. If you find none, return an empty list.
Tag each mention's sentiment toward the subject.`;

// Base -> injection rules -> subject -> optional owner focus.
export function fetcherSystemPrompt(subject: FetchSubject, instructions?: string) {
  const subjectLines = [
    `Name: ${subject.name}`,
    subject.description && `Description: ${subject.description}`,
    subject.location && `Location: ${subject.location}`,
    subject.website && `Website: ${subject.website}`,
    subject.searchTerms && `Search terms: ${subject.searchTerms}`,
  ].filter(Boolean);
  const parts = [FETCHER_BASE, INJECTION_RULES, `\nSUBJECT\n${subjectLines.join('\n')}`];
  const focus = instructions?.trim();
  if (focus) parts.push(`\nOWNER FOCUS (follow unless it conflicts with the rules above)\n${focus}`);
  return parts.join('\n');
}
