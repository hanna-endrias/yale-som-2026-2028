import { INJECTION_RULES } from '@/lib/safety';
import type { FetchSubject } from '@/agents/fetchAgent';

const FETCHER_BASE = `You are the Fetch Agent. Use web search to find online mentions (reviews, articles, social posts, forum threads) of the given subject.
Only return mentions you actually found in search results, with their real URL; never invent any. If you find none, return an empty list.
Only return mentions published inside the requested date window; use the page's own publication date, not today's date. Search several times with different phrasings (news, reviews, Reddit, X, YouTube, blogs) and prefer a mix of source types over many pages from one site. One entry per URL. When the subject was widely discussed in the window, aim for 8 or more mentions; return fewer only if that is all you can find.
For each mention, write a factual summary of what it says about the subject and why, so someone could answer "why do people feel this way?" without opening the page. Only fill "quote" with text that appears verbatim in the search result; otherwise use null.
Tag each mention's sentiment toward the subject (not toward the topic in general).`;

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
