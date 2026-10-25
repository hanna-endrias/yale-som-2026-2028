'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import Button from '@/components/common/Button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PromptItem } from '@/services/promptService';
import { criteriaForEditing, criteriaSummary } from '@/lib/searchCriteria';
import { PROMPT_KIND_LABEL as KIND_LABEL } from '@/lib/validation/prompts';
import PromptEditorModal, { type SubjectOption } from './PromptEditorModal';

type Filter = 'all' | PromptItem['kind'];
type Props = { prompts: PromptItem[]; subjects: SubjectOption[] };

// /prompts: the user's library of chat questions and search criteria, filtered by kind; rows open the editor.
export default function PromptList({ prompts, subjects }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromptItem | null>(null);
  const [editorKey, setEditorKey] = useState(0); // remounts the editor so its fields reset on every open

  const shown = filter === 'all' ? prompts : prompts.filter((p) => p.kind === filter);
  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.name ?? 'Unknown tracker';

  const newLabel = filter === 'all' ? 'New' : `New ${KIND_LABEL[filter].toLowerCase()}`;

  function openEditor(prompt: PromptItem | null) {
    setEditing(prompt);
    setEditorKey((k) => k + 1);
    setOpen(true);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-md p-md sm:p-lg">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="min-w-0 truncate font-heading text-xl font-bold">Prompt library</h1>
          {/* Full label from sm up; just "New" on phones so the header stays on one row. */}
          <Button
            type="button"
            onClick={() => openEditor(null)}
            aria-label={newLabel}
            className="flex shrink-0 items-center gap-xs whitespace-nowrap"
          >
            <Plus className="size-4" /> <span className="sm:hidden">New</span>
            <span className="hidden sm:inline">{newLabel}</span>
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="analyst">Chat questions</TabsTrigger>
            <TabsTrigger value="fetch">Search criteria</TabsTrigger>
          </TabsList>
        </Tabs>

        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filter === 'fetch' ? 'No search criteria yet.' : filter === 'analyst' ? 'No chat questions yet.' : 'Nothing saved yet.'}
          </p>
        ) : (
          <ul className="flex flex-col border-t border-border">
            {shown.map((p) => (
              <li
                key={p.id}
                data-testid="prompt-row"
                onClick={() => openEditor(p)}
                className="flex cursor-pointer flex-col gap-xs border-b border-border px-sm py-sm hover:bg-panel sm:flex-row sm:items-center sm:gap-md"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium" title={p.title}>
                    {p.title}
                  </span>
                  {p.kind === 'fetch' && (
                    <span className="truncate text-xs text-muted-foreground" data-testid="criteria-summary">
                      {criteriaSummary(criteriaForEditing(p))}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-xs">
                  <span className="rounded-sm bg-panel px-xs text-xs font-semibold tracking-wide text-accent-text uppercase">
                    {KIND_LABEL[p.kind]}
                  </span>
                  {p.allSubjects ? (
                    <span className="text-xs text-muted-foreground">All trackers</span>
                  ) : (
                    p.subjectIds.map((id) => (
                      <span key={id} className="rounded-sm border border-border px-xs text-xs">
                        {subjectName(id)}
                      </span>
                    ))
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditor(p);
                    }}
                    className="ml-auto rounded-sm px-xs text-sm font-medium text-accent-text hover:text-accent-hover sm:ml-xs"
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PromptEditorModal
        key={editorKey}
        prompt={editing}
        defaultKind={filter === 'fetch' ? 'fetch' : 'analyst'}
        subjects={subjects}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
