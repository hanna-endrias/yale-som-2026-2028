import type { ButtonHTMLAttributes } from 'react';

export default function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-md bg-button px-md py-sm font-medium text-on-button hover:bg-button-hover focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60 ${className}`}
    />
  );
}
