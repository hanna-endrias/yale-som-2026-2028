import Button from '@/components/common/Button';
import AddSubjectModal from '@/components/subjects/AddSubjectModal';
import type { TrackerOverview } from '@/services/subjectService';
import TrackerCards from './TrackerCards';

// /chat with no session selected: a card per tracker, or the first-tracker CTA.
export default function ChatEmptyState({ trackers }: { trackers: TrackerOverview[] }) {
  if (trackers.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-md p-lg text-center">
        <h1 className="font-heading text-2xl font-bold">Add your first tracker</h1>
        <p className="text-muted-foreground">Add a business, brand, or handle to start tracking what people say.</p>
        <AddSubjectModal trigger={<Button type="button">Add your first tracker</Button>} />
      </div>
    );
  }
  return (
    <div className="flex flex-1 flex-col items-center gap-lg overflow-y-auto p-lg text-center">
      <div className="flex flex-col gap-xs pt-xl">
        <h1 className="font-heading text-2xl font-bold">Your trackers</h1>
        <p className="text-muted-foreground">What's stored so far. Open a chat to ask about it.</p>
      </div>
      <TrackerCards trackers={trackers} />
    </div>
  );
}
