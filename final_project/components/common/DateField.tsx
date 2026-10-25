'use client';

import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Props = {
  label: string;
  id: string;
  name: string;
  defaultValue: string; // YYYY-MM-DD, or '' for no date yet
  min?: string; // YYYY-MM-DD, inclusive
  max?: string; // YYYY-MM-DD, inclusive
  onChange?: (value: string) => void;
};

// YYYY-MM-DD <-> local Date at midnight, so the picked day never shifts with the time zone.
const toDate = (iso: string | undefined) => {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const display = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Labelled date button ("Oct 18, 2026") that opens a popover calendar. Works where the native
// <input type="date"> picker doesn't open. The form value is a hidden YYYY-MM-DD input with `name`,
// so FormData keeps working.
export default function DateField({ label, id, name, defaultValue, min, max, onChange }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = toDate(min);
  const maxDate = toDate(max);

  function pick(day: Date | undefined) {
    if (!day) return; // clicking the selected day again keeps it
    const iso = toIso(day);
    setValue(iso);
    setOpen(false);
    onChange?.(iso);
  }

  return (
    <div className="flex flex-col gap-xs text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            className="flex items-center gap-sm rounded-md border border-border bg-background px-sm py-sm text-left text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus"
          >
            <CalendarIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            {selected ? display(selected) : <span className="text-muted-foreground">Pick a date</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" collisionPadding={8} className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={pick}
            defaultMonth={selected ?? maxDate}
            startMonth={minDate}
            endMonth={maxDate}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          />
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
