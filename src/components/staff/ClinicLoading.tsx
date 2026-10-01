import { LeafMark } from "@/components/maya/Logo";

/** Calm full-page placeholder while the session and staff role are being checked. */
export function ClinicLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-background" role="status" aria-live="polite">
      <span className="sr-only">Checking your access…</span>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 lg:px-6">
        <LeafMark className="h-8 w-8 animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-40 rounded bg-muted" />
      </div>
      <div className="flex gap-2 border-b border-border px-4 py-2 lg:px-6" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-11 w-28 rounded-lg bg-muted/60" />
        ))}
      </div>
      <div className="flex-1 space-y-4 px-4 py-5 lg:px-6" aria-hidden="true">
        <div className="h-7 w-48 rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="surface-tile h-24 rounded-xl border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="surface-tile h-14 rounded-xl border border-border animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
    </div>
  );
}
