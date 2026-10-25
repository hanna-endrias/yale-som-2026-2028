'use client';

import { ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { themeChoices, type ThemeChoice } from '@/config/brand';
import LlmConnectionCheck from './LlmConnectionCheck';

type Props = { email: string; llm: { provider: string; model: string } };

const themeLabels: Record<ThemeChoice, string> = { system: 'System', light: 'Light', dark: 'Dark' };

export default function UserBar({ email, llm }: Props) {
  const router = useRouter();
  // The menu only renders on the client, so reading <html data-theme> here is safe.
  const [theme, setTheme] = useState(() =>
    typeof document === 'undefined' ? 'system' : document.documentElement.dataset.theme,
  );

  function changeTheme(value: string) {
    document.cookie = `theme=${value}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = value;
    setTheme(value);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-sm border-t border-border p-md text-left text-sm hover:bg-background focus-visible:outline-2 focus-visible:outline-focus">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-button font-semibold text-on-button">
          {email[0].toUpperCase()}
        </span>
        <span className="min-w-0 flex-1 truncate">{email}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent side="top" align="start" className="p-sm">
        <DropdownMenuLabel className="truncate text-sm font-semibold text-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={changeTheme}>
          {themeChoices.map((t) => (
            <DropdownMenuRadioItem key={t} value={t} onSelect={(e) => e.preventDefault()}>
              {themeLabels[t]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <div className="px-1.5 py-xs">
          <LlmConnectionCheck provider={llm.provider} model={llm.model} />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
