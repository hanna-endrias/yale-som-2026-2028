import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import TokenCostBadge from '@/components/common/TokenCostBadge';

// Matches markdown links [label](url) and bare http(s) URLs.
const LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)\]]+[^\s.,;:!?)\]])/g;

// Turns links in agent text into clickable anchors; everything else stays plain text.
function linkify(text: string) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const [whole, label, mdUrl, bareUrl] = match;
    out.push(text.slice(last, match.index));
    const href = mdUrl ?? bareUrl;
    out.push(
      <a key={match.index} href={href} target="_blank" rel="noopener noreferrer" className="text-accent-text underline hover:text-accent-hover">
        {label ?? href}
      </a>,
    );
    last = match.index + whole.length;
  }
  out.push(text.slice(last));
  return out;
}

// One message: user turns as a right-aligned bubble; agent turns as text plus tool-call badges.
export default function ChatMessageBubble({ message }: { message: UIMessage }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
    return (
      <div className="max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-panel px-md py-sm">{text}</div>
    );
  }

  // Set by chatService: on the stream's finish part, and from token_usage on reload.
  const usage = message.metadata as { tokens: number; costUsd: number } | undefined;
  return (
    <div className="flex max-w-[85%] flex-col gap-xs self-start" data-testid="assistant-message">
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {linkify(part.text)}
            </p>
          );
        }
        if (isToolUIPart(part)) {
          const done = part.state === 'output-available';
          const failed = part.state === 'output-error';
          return (
            <span
              key={i}
              data-testid="tool-call"
              className="self-start rounded-sm border border-border px-xs text-xs text-muted-foreground"
            >
              tool: {getToolName(part)} {failed ? '✗' : done ? '✓' : '…'}
            </span>
          );
        }
        return null;
      })}
      {usage && <TokenCostBadge tokens={usage.tokens} costUsd={usage.costUsd} />}
    </div>
  );
}
