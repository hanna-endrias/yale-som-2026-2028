import { redirect } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import Sidebar from '@/components/shell/Sidebar';
import { getActiveLlm } from '@/lib/ai';
import { getCurrentUser } from '@/lib/session';
import { listSubjects } from '@/services/subjectService';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const sidebar = <Sidebar subjects={listSubjects(user.id)} email={user.email} llm={getActiveLlm()} />;
  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
