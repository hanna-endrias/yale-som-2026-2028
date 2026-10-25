import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';

export default async function HomePage() {
  redirect((await getCurrentUser()) ? '/chat' : '/login');
}
