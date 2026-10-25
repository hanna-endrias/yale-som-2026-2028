'use client';

import Modal from '@/components/common/Modal';
import SubjectEditForm from './SubjectEditForm';

type Props = {
  subject: { id: number; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Opened from a tracker's [⋯] in the sidebar. Fetches start in the chat (FetchSetupCard / FetchPlanCard).
export default function SubjectModal({ subject, open, onOpenChange }: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={subject.name}>
      <SubjectEditForm subjectId={subject.id} />
    </Modal>
  );
}
