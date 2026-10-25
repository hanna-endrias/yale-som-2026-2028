// "Many views": three overlapping circle outlines (lime, olive/link color, muted gray) from the brand CSS vars,
// so the mark follows the theme. app/icon.svg is the fixed-color favicon version.
export default function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={2.5}
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="12" r="7.5" stroke="var(--brand-color-button)" />
      <circle cx="21" cy="12" r="7.5" stroke="var(--brand-color-accent-text)" />
      <circle cx="16" cy="20.5" r="7.5" stroke="var(--brand-color-muted)" />
    </svg>
  );
}
