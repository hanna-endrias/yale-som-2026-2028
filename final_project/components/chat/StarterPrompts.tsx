import Link from 'next/link';
import type { PromptItem } from '@/services/promptService';

export type StarterPrompt = Pick<PromptItem, 'id' | 'title' | 'body'>;

type Props = {
  subjectName: string;
  prompts: StarterPrompt[];
  onPick: (text: string) => void;
};

// Shown only before the first message; a card shows a library prompt's title and submits its body as the first turn.
export default function StarterPrompts({ subjectName, prompts, onPick }: Props) {
  return (
    <div className="m-auto flex w-full max-w-xl flex-col gap-sm p-md">
      <p className="mb-sm text-center text-muted-foreground">
        Ask the Analyst Agent anything about {subjectName}&apos;s mentions.
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
      {prompts.length > 0 && (
        <Link
          href="/prompts"
          className="self-end text-sm text-muted-foreground hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
        >
          Manage prompts →
        </Link>
      )}
    </div>
  );
}
