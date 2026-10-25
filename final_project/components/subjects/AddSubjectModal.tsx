'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import { expandNewSubject } from '@/components/shell/SubjectFolder';
import { cancelClass, formJson, SubjectFields } from './SubjectEditForm';

// `trigger` is the button that opens it ([+ New subject], or the empty-state CTA).
export default function AddSubjectModal({ trigger }: { trigger: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function onOpenChange(next: boolean) {
    setOpen(next);
    setError('');
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: formJson(e.currentTarget),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Could not create subject.');
    expandNewSubject(data.subject.id);
    setOpen(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="New subject" trigger={trigger}>
      <form onSubmit={onSubmit} className="flex flex-col gap-md">
        <SubjectFields />
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-sm">
          <button type="button" onClick={() => onOpenChange(false)} className={cancelClass}>
            Cancel
          </button>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
