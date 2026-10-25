import { Plus } from 'lucide-react';
import Logo from '@/components/common/Logo';
import AddSubjectModal from '@/components/subjects/AddSubjectModal';
import type { SidebarSubject } from '@/services/subjectService';
import PromptLibraryLink from './PromptLibraryLink';
import SubjectFolder from './SubjectFolder';
import UserBar from './UserBar';

type Props = {
  subjects: SidebarSubject[];
  email: string;
  llm: { provider: string; model: string };
};

export default function Sidebar({ subjects, email, llm }: Props) {
  return (
    <nav className="flex h-full w-full flex-col bg-panel">
      <div className="flex flex-col gap-sm p-md">
        <span className="flex items-center gap-xs font-heading text-lg font-bold">
          <Logo size={24} /> Perspectives
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-xs overflow-y-auto px-sm">
        <div className="flex items-center justify-between px-sm">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">TRACKERS</p>
          <AddSubjectModal
            trigger={
              <button
                type="button"
                aria-label="New tracker"
                title="New tracker"
                data-testid="new-tracker"
                className="rounded-md p-xs text-muted-foreground hover:bg-background hover:text-accent-text focus-visible:outline-2 focus-visible:outline-focus"
              >
                <Plus className="size-4" />
              </button>
            }
          />
        </div>
        {subjects.length === 0 ? (
          <p className="px-sm text-sm text-muted-foreground">No trackers yet.</p>
        ) : (
          subjects.map((s) => <SubjectFolder key={s.id} subject={s} />)
        )}
        <div className="mt-sm border-t border-border pt-sm">
          <PromptLibraryLink />
        </div>
      </div>

      <UserBar email={email} llm={llm} />
    </nav>
  );
}
