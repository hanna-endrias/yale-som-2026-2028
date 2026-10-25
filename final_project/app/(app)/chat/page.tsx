import { redirect } from 'next/navigation';
import ChatEmptyState from '@/components/chat/ChatEmptyState';
import { getCurrentUser } from '@/lib/session';
import { listTrackerOverviews } from '@/services/subjectService';

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return <ChatEmptyState trackers={listTrackerOverviews(user.id)} />;
}
