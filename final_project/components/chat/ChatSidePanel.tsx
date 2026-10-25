'use client';

import { PanelRightClose, PanelRightOpen, Pencil, Plus } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import TokenCostBadge from '@/components/common/TokenCostBadge';
import PromptEditorModal, { type SubjectOption } from '@/components/prompts/PromptEditorModal';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatRange } from '@/lib/dateRanges';
import { criteriaForEditing, criteriaSummary } from '@/lib/searchCriteria';
import type { PromptItem } from '@/services/promptService';
import { useChatActions, type SetupPrefill } from './ChatActions';
import { isoDaysAgo } from './FetchSetupCard';
import { POLL_MS, statusClass, statusLabel, type Run } from './FetchRunProgress';

type Tab = 'questions' | 'criteria' | 'fetches';
type PanelState = {
  isDesktop: boolean | null; // null until mounted (matchMedia)
  open: boolean; // the inline panel, lg and up (saved in localStorage)
  sheetOpen: boolean; // below lg the panel is a right-side sheet
  setSheetOpen: (open: boolean) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  toggle: () => void;
  show: (tab: Tab) => void; // open the panel (or sheet) on a tab
};

const STORAGE_KEY = 'perspectives.chatPanel';
const DESKTOP = '(min-width: 64rem)'; // Tailwind lg
const PanelContext = createContext<PanelState | null>(null);

// The chat page's side-panel state, shared by the header toggle, the panel and the starter prompts' "Manage prompts".
export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [open, setOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('questions');

  useEffect(() => {
    setOpen(localStorage.getItem(STORAGE_KEY) !== 'closed');
    const mq = window.matchMedia(DESKTOP);
    const update = () => {
      setIsDesktop(mq.matches);
      if (mq.matches) setSheetOpen(false);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const setInline = useCallback((next: boolean) => {
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, next ? 'open' : 'closed');
  }, []);

  const value: PanelState = {
    isDesktop,
    open,
    sheetOpen,
    setSheetOpen,
    tab,
    setTab,
    toggle: () => (isDesktop ? setInline(!open) : setSheetOpen(!sheetOpen)),
    show: (t) => {
      setTab(t);
      if (isDesktop) setInline(true);
      else setSheetOpen(true);
    },
  };
  return <PanelContext.Provider value={value}>{children}</PanelContext.Provider>;
}

// Null outside ChatPanelProvider.
export const useChatPanel = () => useContext(PanelContext);

// Header button: collapses/expands the inline panel (lg+), or opens the sheet below lg.
export function ChatPanelToggle() {
  const panel = useChatPanel();
  if (!panel) return null;
  const shown = panel.isDesktop ? panel.open : panel.sheetOpen;
  const Icon = shown ? PanelRightClose : PanelRightOpen;
  return (
    <button
      type="button"
      onClick={panel.toggle}
      aria-label={shown ? 'Hide side panel' : 'Show side panel'}
      aria-expanded={shown}
      title={shown ? 'Hide side panel' : 'Questions, search criteria and fetches'}
      data-testid="panel-toggle"
      className="ml-auto shrink-0 rounded-md p-xs text-muted-foreground hover:bg-panel hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
    >
      <Icon className="size-5" />
    </button>
  );
}

type Props = { subjectId: number; subjectName: string; subjects: SubjectOption[] };

// Right side of a chat: the tracker's chat questions, saved search criteria and fetch history.
// Inline (≈18rem, border-l) from lg up, a right-side sheet below. Rendered inside ChatWindow's ChatActions provider.
export default function ChatSidePanel(props: Props) {
  const panel = useChatPanel();
  // Below lg, an action runs after the sheet has closed so focus can move to the chat box.
  const pending = useRef<(() => void) | null>(null);
  if (!panel || panel.isDesktop === null) return null;

  if (panel.isDesktop) {
    if (!panel.open) return null;
    return (
      <aside aria-label="Side panel" data-testid="chat-side-panel" className="flex w-72 shrink-0 flex-col border-l border-border">
        <PanelBody {...props} run={(fn) => fn()} />
      </aside>
    );
  }

  return (
    <Sheet open={panel.sheetOpen} onOpenChange={panel.setSheetOpen}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        data-testid="chat-side-sheet"
        className="gap-0 border-border pt-xl lg:hidden"
        onCloseAutoFocus={(e) => {
          const fn = pending.current;
          if (!fn) return;
          e.preventDefault();
          pending.current = null;
          fn();
        }}
      >
        <SheetTitle className="sr-only">Side panel</SheetTitle>
        <PanelBody
          {...props}
          run={(fn) => {
            pending.current = fn;
            panel.setSheetOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

const addDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000 + 1;

// Setup-card dates for saved criteria: the day after the latest date fetched with them through yesterday
// (cadence sized to stay within 31 windows), else the card's default last 7 days.
function nextFetch(runs: Run[] | null, p: PromptItem): SetupPrefill {
  const latest = (runs ?? [])
    .filter((r) => r.status !== 'failed' && (r.instructions ?? '').trim() === p.body.trim())
    .map((r) => r.endDate)
    .sort()
    .at(-1);
  const yesterday = isoDaysAgo(1);
  if (!latest || addDay(latest) > yesterday) return { promptId: p.id };
  const startDate = addDay(latest);
  const days = daysBetween(startDate, yesterday);
  const cadence = days <= 31 ? 'daily' : days <= 31 * 7 ? 'weekly' : 'monthly';
  return { promptId: p.id, startDate, endDate: yesterday, cadence };
}

const rowClass = 'group flex items-center border-b border-border';
const rowButtonClass =
  'flex min-w-0 flex-1 items-center gap-sm px-sm py-sm text-left hover:bg-panel focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';
// Shown on hover/focus from lg up; always on touch-sized screens (the sheet).
const hoverActionClass =
  'shrink-0 text-xs font-medium text-accent-text lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100';
const iconButtonClass =
  'shrink-0 rounded-md p-xs text-muted-foreground hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus';
const addClass =
  'flex items-center gap-xs self-start rounded-md px-sm py-xs text-sm font-medium text-accent-text hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-focus';

function PanelBody({ subjectId, subjects, run }: Props & { run: (fn: () => void) => void }) {
  const panel = useChatPanel()!;
  const { setDraft, addSetupCard, runsVersion } = useChatActions();
  const [questions, setQuestions] = useState<PromptItem[] | null>(null);
  const [criteria, setCriteria] = useState<PromptItem[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [promptsVersion, setPromptsVersion] = useState(0);
  const [editor, setEditor] = useState<{ key: number; prompt: PromptItem | null; kind: PromptItem['kind'] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = (kind: PromptItem['kind']) =>
      fetch(`/api/prompts?kind=${kind}&subjectId=${subjectId}`)
        .then((res) => (res.ok ? res.json() : { prompts: [] }))
        .then((data) => data.prompts as PromptItem[])
        .catch(() => []);
    load('analyst').then((ps) => !cancelled && setQuestions(ps));
    load('fetch').then((ps) => !cancelled && setCriteria(ps));
    return () => {
      cancelled = true;
    };
  }, [subjectId, promptsVersion]);

  // Run history; polls every 3 s while any run is pending or running. Reloads when a chat card starts runs.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      const res = await fetch(`/api/subjects/${subjectId}/fetch-runs`).catch(() => null);
      if (cancelled || !res?.ok) return;
      const list = (await res.json()).runs as Run[];
      if (cancelled) return;
      setRuns(list);
      if (list.some((r) => r.status === 'pending' || r.status === 'running')) timer = setTimeout(load, POLL_MS);
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [subjectId, runsVersion]);

  const openEditor = (prompt: PromptItem | null, kind: PromptItem['kind']) =>
    setEditor({ key: Date.now(), prompt, kind });

  return (
    <>
      <Tabs
        value={panel.tab}
        onValueChange={(v) => panel.setTab(v as Tab)}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList className="m-sm w-auto self-stretch">
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="criteria">Criteria</TabsTrigger>
          <TabsTrigger value="fetches">Fetches</TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="flex min-h-0 flex-col gap-xs overflow-y-auto" data-testid="panel-questions">
          {questions === null ? (
            <p className="px-sm text-muted-foreground">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="px-sm text-muted-foreground">No chat questions yet.</p>
          ) : (
            <ul className="flex flex-col border-t border-border">
              {questions.map((p) => (
                <li key={p.id} className={rowClass} data-testid="panel-question">
                  <button
                    type="button"
                    aria-label={`Use in chat: ${p.title}`}
                    title={p.body}
                    onClick={() => run(() => setDraft(p.body))}
                    className={rowButtonClass}
                  >
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <span aria-hidden className={hoverActionClass}>
                      Use in chat
                    </span>
                  </button>
                  <button type="button" aria-label={`Edit ${p.title}`} onClick={() => openEditor(p, 'analyst')} className={iconButtonClass}>
                    <Pencil className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => openEditor(null, 'analyst')} className={addClass}>
            <Plus className="size-4" /> New question
          </button>
        </TabsContent>

        <TabsContent value="criteria" className="flex min-h-0 flex-col gap-xs overflow-y-auto" data-testid="panel-criteria">
          <p className="px-sm text-xs text-muted-foreground">Pick saved criteria to set up a new fetch in the chat.</p>
          {criteria === null ? (
            <p className="px-sm text-muted-foreground">Loading…</p>
          ) : criteria.length === 0 ? (
            <p className="px-sm text-muted-foreground">No search criteria for this tracker yet.</p>
          ) : (
            <ul className="flex flex-col border-t border-border">
              {criteria.map((p) => (
                <li key={p.id} className={rowClass} data-testid="panel-criteria-row">
                  <button
                    type="button"
                    aria-label={`New fetch with ${p.title}`}
                    onClick={() => run(() => addSetupCard(nextFetch(runs, p)))}
                    className={rowButtonClass}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {criteriaSummary(criteriaForEditing(p)) || 'No constraints'}
                      </span>
                    </span>
                    <span aria-hidden className={hoverActionClass}>
                      New fetch
                    </span>
                  </button>
                  <button type="button" aria-label={`Edit ${p.title}`} onClick={() => openEditor(p, 'fetch')} className={iconButtonClass}>
                    <Pencil className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => openEditor(null, 'fetch')} className={addClass}>
            <Plus className="size-4" /> New criteria
          </button>
        </TabsContent>

        <TabsContent value="fetches" className="min-h-0 overflow-y-auto" data-testid="panel-fetches">
          {runs === null ? (
            <p className="px-sm text-muted-foreground">Loading…</p>
          ) : runs.length === 0 ? (
            <p className="px-sm text-muted-foreground">No fetches yet.</p>
          ) : (
            <ul className="flex flex-col border-t border-border">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-col gap-xs border-b border-border px-sm py-sm" data-testid="panel-run">
                  <div className="flex items-center justify-between gap-sm">
                    <span className="font-medium">
                      {formatRange({ start: r.startDate, end: r.endDate })}, {r.endDate.slice(0, 4)}
                    </span>
                    <span className={`text-xs font-medium ${statusClass[r.status]}`}>{statusLabel(r.status)}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={r.instructions ?? undefined}>
                    {r.cadence} · Criteria: {r.instructions?.trim().split('\n')[0] || 'None'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-sm text-xs">
                    <span>
                      {r.mentionCount} {r.mentionCount === 1 ? 'mention' : 'mentions'}
                    </span>
                    {r.tokens > 0 && <TokenCostBadge tokens={r.tokens} costUsd={r.costUsd} />}
                  </div>
                  {r.status === 'failed' && r.error && <p className="text-xs text-destructive">{r.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      {editor && (
        <PromptEditorModal
          key={editor.key}
          prompt={editor.prompt}
          defaultKind={editor.kind}
          defaultSubjectIds={[subjectId]}
          subjects={subjects}
          open
          onOpenChange={(o) => !o && setEditor(null)}
          onSaved={() => setPromptsVersion((v) => v + 1)}
        />
      )}
    </>
  );
}
