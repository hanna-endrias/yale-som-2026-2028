import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TokenCostBadge from '@/components/common/TokenCostBadge';
import type { AssistantMetadata } from '@/services/chatService';
import FetchPlanCard, { isFetchPlan } from './FetchPlanCard';
import PromptDeleteCard, { isPromptDelete } from './PromptDeleteCard';
import PromptUpdateCard, { isPromptUpdate } from './PromptUpdateCard';
import VisualizationFrame from './VisualizationFrame';

const isVisualization = (o: unknown): o is { title: string; html: string } =>
  typeof o === 'object' && o !== null && typeof (o as { html?: unknown }).html === 'string';

// The card a tool's output renders as, by tool name (names match agents/tools; that module is server-only).
// laterUserMessage: a user turn follows this message (a fetch card then never re-asks its question).
// toolCallId: the same live and after reload (chatService saves it), so a fetch card can record what it started.
function ToolCard({
  toolName,
  toolCallId,
  output,
  laterUserMessage,
}: {
  toolName: string;
  toolCallId: string;
  output: unknown;
  laterUserMessage: boolean;
}) {
  switch (toolName) {
    case 'createVisualization':
      return isVisualization(output) ? <VisualizationFrame title={output.title} html={output.html} /> : null;
    case 'planFetchRun':
      return isFetchPlan(output) ? <FetchPlanCard plan={output} toolCallId={toolCallId} laterUserMessage={laterUserMessage} /> : null;
    case 'updatePrompt':
      return isPromptUpdate(output) ? <PromptUpdateCard update={output} /> : null;
    case 'deletePrompt':
      return isPromptDelete(output) ? <PromptDeleteCard prompt={output} /> : null;
    default:
      return null;
  }
}

// Links become citation pills; a URL that isn't a stored mention of this subject is flagged.
function citationLink(unverified: Set<string>): Components['a'] {
  return function CitationLink({ href, children }) {
    const bad = !!href && unverified.has(href);
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={bad ? `Not found in stored mentions: ${href}` : href}
        data-testid="citation"
        data-verified={!bad}
        className={`mx-[1px] inline-flex items-center gap-[2px] rounded-sm border px-xs align-baseline text-xs no-underline hover:bg-panel ${
          bad ? 'border-destructive text-destructive' : 'border-border text-accent-text hover:text-accent-hover'
        }`}
      >
        {bad && <span aria-label="unverified source">⚠</span>}
        {children}
      </a>
    );
  };
}

// Tailwind styles for markdown elements (there is no typography plugin).
const BASE: Components = {
  h1: ({ children }) => <h3 className="mt-sm text-lg font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-sm text-lg font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-sm font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-sm font-semibold">{children}</h4>,
  p: ({ children }) => <p className="leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="ml-md list-disc space-y-xs">{children}</ul>,
  ol: ({ children }) => <ol className="ml-md list-decimal space-y-xs">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-sm text-muted-foreground">{children}</blockquote>,
  code: ({ children }) => <code className="rounded-sm bg-panel px-xs text-sm">{children}</code>,
  table: ({ children }) => (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-panel text-left">{children}</thead>,
  th: ({ children }) => <th className="border-b border-border px-sm py-xs font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-sm py-xs align-top">{children}</td>,
};

// One message: user turns as a right-aligned bubble; agent turns as markdown, tool-call badges and charts.
export default function ChatMessageBubble({
  message,
  laterUserMessage = false,
}: {
  message: UIMessage;
  laterUserMessage?: boolean; // a user turn comes after this message
}) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
    return (
      <div className="min-w-0 max-w-[85%] self-end whitespace-pre-wrap rounded-lg bg-panel px-md py-sm [overflow-wrap:anywhere]">{text}</div>
    );
  }

  // Set by chatService: on the stream's finish part, and from token_usage on reload.
  const meta = message.metadata as AssistantMetadata | undefined;
  const components = { ...BASE, a: citationLink(new Set(meta?.unverifiedUrls ?? [])) };
  return (
    <div className="flex w-full min-w-0 max-w-[85%] flex-col gap-xs self-start [overflow-wrap:anywhere]" data-testid="assistant-message">
      {message.parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <div key={i} className="flex flex-col gap-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {part.text}
              </ReactMarkdown>
            </div>
          );
        }
        if (isToolUIPart(part)) {
          const toolName = getToolName(part);
          const done = part.state === 'output-available';
          const failed = part.state === 'output-error';
          return (
            <div key={i} className="flex flex-col gap-xs">
              <span
                data-testid="tool-call"
                className="self-start rounded-sm border border-border px-xs text-xs text-muted-foreground"
              >
                tool: {toolName} {failed ? '✗' : done ? '✓' : '…'}
              </span>
              {done && (
                <ToolCard
                  toolName={toolName}
                  toolCallId={part.toolCallId}
                  output={part.output}
                  laterUserMessage={laterUserMessage}
                />
              )}
            </div>
          );
        }
        return null;
      })}
      {meta && <TokenCostBadge tokens={meta.tokens} costUsd={meta.costUsd} />}
    </div>
  );
}
