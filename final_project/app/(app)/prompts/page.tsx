import { redirect } from 'next/navigation';
import PromptList from '@/components/prompts/PromptList';
import { getCurrentUser } from '@/lib/session';
import { listPrompts } from '@/services/promptService';
import { listSubjects } from '@/services/subjectService';

export default async function PromptsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const subjects = listSubjects(user.id).map(({ id, name }) => ({ id, name }));
  return <PromptList prompts={listPrompts(user.id)} subjects={subjects} />;
}
