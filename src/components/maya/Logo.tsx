export function LeafMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M9 23c0-8 5-13 14-14-1 9-6 14-14 14Z" className="fill-primary-foreground" />
      <path d="M9 23l8-8" strokeWidth="1.8" strokeLinecap="round" className="stroke-primary" />
    </svg>
  );
}
