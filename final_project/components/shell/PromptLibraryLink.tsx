'use client';

import { BookText } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Sidebar link to /prompts, highlighted while there.
export default function PromptLibraryLink() {
  const active = usePathname() === '/prompts';
  return (
    <Link
      href="/prompts"
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-xs rounded-md px-sm py-xs text-sm hover:bg-background hover:text-accent-text ${
        active ? 'bg-background font-semibold text-accent-text' : ''
      }`}
    >
      <BookText className="size-4" /> Prompt library
    </Link>
  );
}
