import Button from '@/components/common/Button';
import AddSubjectModal from '@/components/subjects/AddSubjectModal';

// /chat with no session selected.
export default function ChatEmptyState({ hasSubjects }: { hasSubjects: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-md p-lg text-center">
      <h1 className="font-heading text-2xl font-bold">
        {hasSubjects ? 'Welcome to Perspectives' : 'Add your first tracker'}
      </h1>
      {hasSubjects ? (
        <p className="text-muted-foreground">Pick a tracker and press + to start a chat.</p>
      ) : (
        <>
          <p className="text-muted-foreground">Add a business, brand, or handle to start tracking what people say.</p>
          <AddSubjectModal trigger={<Button type="button">Add your first tracker</Button>} />
        </>
      )}
    </div>
  );
}
