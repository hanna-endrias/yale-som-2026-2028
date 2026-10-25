import { redirect } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import Card from '@/components/common/Card';
import { getCurrentUser } from '@/lib/session';

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/chat');
  return (
    <main className="flex min-h-screen items-center justify-center px-md py-xl">
      <Card className="w-full max-w-96">
        <h1 className="mb-lg text-center font-heading text-2xl font-bold">Perspectives</h1>
        <LoginForm />
      </Card>
    </main>
  );
}
