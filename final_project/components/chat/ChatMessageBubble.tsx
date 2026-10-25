import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { ListChecks } from 'lucide-react';
import { Children, isValidElement, useState } from 'react';
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

// Friendly names for the activity line (names match agents/tools); unknown tools show their raw name.
const TOOL_LABELS: Record<string, string> = {
  getSentimentSummary: 'sentiment',
  getThemes: 'themes',
  getTopSources: 'sources',
  getMentions: 'mentions',
  createVisualization: 'chart',
  listFetchRuns: 'fetch history',
  planFetchRun: 'fetch plan',
  listPrompts: 'prompt library',
  createPrompt: 'prompt library',
  updatePrompt: 'prompt library',
  deletePrompt: 'prompt library',
};

type ToolPart = Extract<UIMessage['parts'][number], { toolCallId: string }>;
type Block = { kind: 'text'; key: number; text: string } | { kind: 'tools'; key: number; tools: ToolPart[] };

const toolLabel = (part: ToolPart) => {
  const name = getToolName(part);
  return TOOL_LABELS[name] ?? name;
};

// "a", "a and b", "a, b and c".
function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

// Text parts stay as they are; consecutive tool parts become one group. Parts that render nothing
// (step-start, reasoning, …) don't break a group.
function groupParts(parts: UIMessage['parts']): Block[] {
  const blocks: Block[] = [];
  parts.forEach((part, i) => {
    if (part.type === 'text') {
      blocks.push({ kind: 'text', key: i, text: part.text });
    } else if (isToolUIPart(part)) {
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'tools') last.tools.push(part as ToolPart);
      else blocks.push({ kind: 'tools', key: i, tools: [part as ToolPart] });
    }
  });
  return blocks;
}

// One quiet line per group of tool calls: "Checking themes…" while running, "Checked a, b and c" when done.
// live: the reply is still streaming and nothing but tools follows this group, so between steps it keeps pulsing.
function ToolActivity({ tools, live }: { tools: ToolPart[]; live: boolean }) {
  const finished = (t: ToolPart) => t.state === 'output-available' || t.state === 'output-error' || t.state === 'output-denied';
  const running = tools.filter((t) => !finished(t));
  const failed = tools.filter((t) => t.state === 'output-error').length;
  const labels = [...new Set(tools.map(toolLabel))];
  return (
    <div data-testid="tool-activity" className="flex items-center gap-xs self-start text-xs text-muted-foreground">
      <ListChecks className="size-3.5 shrink-0" aria-hidden />
      {running.length > 0 || live ? (
        <span className="animate-pulse">Checking {toolLabel(running[running.length - 1] ?? tools[tools.length - 1])}…</span>
      ) : (
        <span>
          Checked {joinLabels(labels)}
          {failed > 0 && (
            <span className="text-destructive">
              {' '}
              · {failed} {failed === 1 ? 'step' : 'steps'} failed
            </span>
          )}
        </span>
      )}
    </div>
  );
}

// Links become citation pills; a URL that isn't a stored mention of this subject is flagged.
// A non-web link (the model sometimes writes "[see the chart](#)") is just text, not a source.
function citationLink(unverified: Set<string>): Components['a'] {
  return function CitationLink({ href, children }) {
    if (!href || !/^https?:\/\//i.test(href)) return <>{children}</>;
    const bad = unverified.has(href);
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

const SHOWN_CITATIONS = 4;

// A paragraph or list item with a long run of citation pills shows the first few and a "+N more sources" toggle.
// Only http(s) links count (CitationLink renders other links as text); prose after the last pill stays visible.
function CollapsedCitations({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const items = Children.toArray(children);
  const links = items.flatMap((c, i) =>
    isValidElement<{ href?: string }>(c) && /^https?:\/\//i.test(c.props.href ?? '') ? [i] : [],
  );
  if (expanded || links.length <= SHOWN_CITATIONS + 1) return <>{children}</>;
  return (
    <>
      {items.slice(0, links[SHOWN_CITATIONS - 1] + 1)}{' '}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="rounded-sm text-xs font-medium text-muted-foreground underline hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
      >
        +{links.length - SHOWN_CITATIONS} more sources
      </button>
      {items.slice(links[links.length - 1] + 1)}
    </>
  );
}

// Tailwind styles for markdown elements (there is no typography plugin).
const BASE: Components = {
  h1: ({ children }) => <h3 className="mt-sm text-lg font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-sm text-lg font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-sm font-semibold">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-sm font-semibold">{children}</h4>,
  p: ({ children }) => (
    <p className="leading-relaxed">
      <CollapsedCitations>{children}</CollapsedCitations>
    </p>
  ),
  li: ({ children }) => (
    <li>
      <CollapsedCitations>{children}</CollapsedCitations>
    </li>
  ),
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

// One message: user turns as a right-aligned bubble; agent turns as markdown, tool activity lines and charts.
export default function ChatMessageBubble({
  message,
  laterUserMessage = false,
  streaming = false,
}: {
  message: UIMessage;
  laterUserMessage?: boolean; // a user turn comes after this message
  streaming?: boolean; // this is the live reply (only the last message, never one reloaded from the DB)
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
      {groupParts(message.parts).map((block, i, blocks) => {
        if (block.kind === 'text') {
          return (
            <div key={block.key} className="flex flex-col gap-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {block.text}
              </ReactMarkdown>
            </div>
          );
        }
        return (
          <div key={block.key} className="flex flex-col gap-xs">
            <ToolActivity tools={block.tools} live={streaming && i === blocks.length - 1} />
            {block.tools.map(
              (t) =>
                t.state === 'output-available' && (
                  <ToolCard
                    key={t.toolCallId}
                    toolName={getToolName(t)}
                    toolCallId={t.toolCallId}
                    output={t.output}
                    laterUserMessage={laterUserMessage}
                  />
                ),
            )}
          </div>
        );
      })}
      {meta && <TokenCostBadge tokens={meta.tokens} costUsd={meta.costUsd} />}
    </div>
  );
}
