'use client';

import { useState } from 'react';
import Modal from '@/components/common/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FetchRunForm from './FetchRunForm';
import FetchRunStatusList from './FetchRunStatusList';
import SubjectEditForm from './SubjectEditForm';

type Props = {
  subject: { id: number; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Opened from a subject's [⋯] in the sidebar.
export default function SubjectModal({ subject, open, onOpenChange }: Props) {
  const [runsKey, setRunsKey] = useState(0);
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={subject.name}>
      <Tabs defaultValue="runs" className="gap-md">
        <TabsList>
          <TabsTrigger value="runs">Fetch runs</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="runs" className="flex flex-col gap-lg">
          <FetchRunForm subjectId={subject.id} onStarted={() => setRunsKey((k) => k + 1)} />
          <FetchRunStatusList subjectId={subject.id} refreshKey={runsKey} />
        </TabsContent>
        <TabsContent value="details">
          <SubjectEditForm subjectId={subject.id} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}
