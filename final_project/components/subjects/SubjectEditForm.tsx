'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';

type SubjectValues = {
  name: string;
  description: string;
  location: string | null;
  website: string | null;
  searchTerms: string;
};

const deleteClass =
  'rounded-md border border-destructive px-md py-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60';
export const cancelClass = 'rounded-md border border-border px-md py-sm font-medium hover:bg-panel';

// The subject fields, shared by AddSubjectModal and the Details tab.
export function SubjectFields({ values }: { values?: SubjectValues }) {
  return (
    <>
      <Input label="Name*" id="subject-name" name="name" defaultValue={values?.name} />
      <Input label="Description" id="subject-description" name="description" defaultValue={values?.description} />
      <Input label="Location" id="subject-location" name="location" defaultValue={values?.location ?? ''} />
      <Input label="Website" id="subject-website" name="website" defaultValue={values?.website ?? ''} />
      <Input label="Search terms" id="subject-search-terms" name="searchTerms" defaultValue={values?.searchTerms} />
    </>
  );
}

export const formJson = (form: HTMLFormElement) => JSON.stringify(Object.fromEntries(new FormData(form)));

// SubjectModal › Details: edit and save, or delete (with a confirm step).
export default function SubjectEditForm({ subjectId }: { subjectId: number }) {
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectValues | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/subjects/${subjectId}`)
      .then((res) => res.json())
      .then((data) => (data.subject ? setSubject(data.subject) : setError(data.error ?? 'Could not load tracker.')));
  }, [subjectId]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    const res = await fetch(`/api/subjects/${subjectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: formJson(e.currentTarget),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? 'Could not save.');
    setSubject(data.subject);
    setSaved(true);
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const res = await fetch(`/api/subjects/${subjectId}`, { method: 'DELETE' });
    if (!res.ok) {
      setBusy(false);
      return setError((await res.json()).error ?? 'Could not delete.');
    }
    router.push('/chat');
    router.refresh();
  }

  if (!subject) {
    return <p className={`text-sm ${error ? 'text-destructive' : 'text-muted-foreground'}`}>{error || 'Loading…'}</p>;
  }

  return (
    <form onSubmit={onSave} className="flex flex-col gap-md">
      <SubjectFields values={subject} />
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
      {confirming ? (
        <div className="flex flex-wrap items-center justify-end gap-sm">
          <p className="basis-full text-sm">Delete {subject.name} and all its chats and mentions?</p>
          <button type="button" onClick={() => setConfirming(false)} className={cancelClass}>
            Cancel
          </button>
          <button type="button" onClick={onDelete} disabled={busy} className={deleteClass}>
            Delete
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-sm">
          <button
            type="button"
            onClick={() => {
              setError('');
              setConfirming(true);
            }}
            className={deleteClass}
          >
            Delete tracker
          </button>
          <div className="flex items-center gap-sm">
            {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
            <Button type="submit" disabled={busy}>
              Save
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
