export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="surface-tile h-16 animate-pulse rounded-xl border border-border" />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
