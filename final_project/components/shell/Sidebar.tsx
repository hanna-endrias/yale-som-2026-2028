import { Plus } from 'lucide-react';
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
        <span className="font-heading text-lg font-bold">Perspectives</span>
        <AddSubjectModal
          trigger={
            <button
              type="button"
              className="flex items-center gap-xs self-start rounded-md border border-border bg-background px-sm py-xs text-sm font-medium hover:text-accent-text"
            >
              <Plus className="size-4" /> New subject
            </button>
          }
        />
        <PromptLibraryLink />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-xs overflow-y-auto px-sm">
        <p className="px-sm text-xs font-semibold tracking-wide text-muted-foreground">SUBJECTS</p>
        {subjects.length === 0 ? (
          <p className="px-sm text-sm text-muted-foreground">No subjects yet.</p>
        ) : (
          subjects.map((s) => <SubjectFolder key={s.id} subject={s} />)
        )}
      </div>

      <UserBar email={email} llm={llm} />
    </nav>
  );
}
