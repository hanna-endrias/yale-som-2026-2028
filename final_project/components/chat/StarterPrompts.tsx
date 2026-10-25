'use client';

import Link from 'next/link';
import { useChatPanel } from './ChatSidePanel';
import type { PromptItem } from '@/services/promptService';

export type StarterPrompt = Pick<PromptItem, 'id' | 'title' | 'body'>;

type Props = {
  subjectName: string;
  prompts: StarterPrompt[];
  onPick: (text: string) => void;
  waitingForData?: boolean; // no fetch yet: a pick is remembered and asked once the setup card's fetch finishes
};

// Shown only before the first message; a card shows a library prompt's title and passes its body to onPick.
export default function StarterPrompts({ subjectName, prompts, onPick, waitingForData }: Props) {
  const panel = useChatPanel();
  const manageClass =
    'self-end text-sm text-muted-foreground hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus';
  return (
    <div className={`flex w-full max-w-xl flex-col gap-sm p-md ${waitingForData ? 'mx-auto' : 'm-auto'}`}>
      <p className="mb-sm text-center text-muted-foreground">
        {waitingForData
          ? "Pick a question now and we'll ask it once the fetch finishes."
          : `Ask the Analyst Agent anything about ${subjectName}'s mentions.`}
      </p>
      {prompts.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p.body)}
          className="rounded-lg border border-border bg-panel px-md py-sm text-left text-sm hover:border-accent-text hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
        >
          {p.title}
        </button>
      ))}
      {/* Opens the side panel's Questions tab; /prompts stays the full library. */}
      {prompts.length > 0 &&
        (panel ? (
          <button type="button" onClick={() => panel.show('questions')} className={manageClass}>
            Manage prompts →
          </button>
        ) : (
          <Link href="/prompts" className={manageClass}>
            Manage prompts →
          </Link>
        ))}
    </div>
  );
}
