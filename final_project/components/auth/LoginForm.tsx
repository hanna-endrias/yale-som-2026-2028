'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    if (res.ok) return router.replace('/chat');
    setError((await res.json()).error ?? 'Login failed.');
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-md">
      <Input label="Email" id="email" name="email" type="email" autoComplete="email" required />
      <Input label="Password" id="password" name="password" type="password" autoComplete="current-password" required />
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={loading}>
        {loading ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-accent-text hover:text-accent-hover">
          Sign up
        </Link>
      </p>
    </form>
  );
}
