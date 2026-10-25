import { redirect } from 'next/navigation';
import SignupForm from '@/components/auth/SignupForm';
import Card from '@/components/common/Card';
import { getCurrentUser } from '@/lib/session';

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/chat');
  return (
    <main className="flex min-h-screen items-center justify-center px-md py-xl">
      <Card className="w-full max-w-96">
        <h1 className="mb-lg text-center font-heading text-2xl font-bold">Perspectives</h1>
        <SignupForm />
      </Card>
    </main>
  );
}
