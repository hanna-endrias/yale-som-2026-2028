import type { HTMLAttributes } from 'react';

export default function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-lg border border-border bg-panel p-lg ${className}`} />;
}
