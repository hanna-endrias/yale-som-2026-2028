'use client';

import { Menu } from 'lucide-react';
import { useState } from 'react';
import Logo from '@/components/common/Logo';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

// 2 columns (Sidebar | main) from sm up; below sm the sidebar is a sheet drawer.
export default function AppShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen">
      <div className="hidden w-64 shrink-0 border-r border-border sm:flex">{sidebar}</div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="gap-0 border-border sm:hidden"
          // Picking a session (a link) closes the drawer.
          onClick={(e) => (e.target as HTMLElement).closest('a') && setOpen(false)}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-sm border-b border-border p-sm sm:hidden">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setOpen(true)}
            className="rounded-md p-xs hover:bg-panel"
          >
            <Menu className="size-5" />
          </button>
          <span className="flex items-center gap-xs font-heading font-bold">
            <Logo size={20} /> Perspectives
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}
