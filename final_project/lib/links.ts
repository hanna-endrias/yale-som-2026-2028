// Markdown link targets [label](url) and bare http(s) URLs.
const URL_RE = /\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+[^\s.,;:!?)\]'"])/g;

// Every URL in agent text, in order (duplicates kept).
export function extractUrls(text: string): string[] {
  return [...text.matchAll(URL_RE)].map((m) => m[1] ?? m[2]);
}
