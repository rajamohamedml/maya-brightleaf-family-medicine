import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="surface-tile flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center transition-colors duration-200 hover:border-surface-hover">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {children && <div className="mt-1 max-w-md text-muted-foreground">{children}</div>}
    </div>
  );
}
