import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Input({ label, id, className = '', ...props }: Props) {
  return (
    <label htmlFor={id} className="flex flex-col gap-xs text-sm font-medium">
      {label}
      <input
        id={id}
        {...props}
        className={`rounded-md border border-border bg-background px-sm py-sm text-base font-normal text-text focus-visible:outline-2 focus-visible:outline-focus ${className}`}
      />
    </label>
  );
}
