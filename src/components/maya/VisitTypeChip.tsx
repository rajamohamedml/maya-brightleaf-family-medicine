import { Building2, Video } from "lucide-react";
import type { VisitMode } from "@/lib/clinic-info";

export function VisitTypeChip({ name, minutes, mode }: { name: string; minutes?: number; mode: VisitMode }) {
  const Icon = mode === "telehealth" ? Video : Building2;
  return (
    <span className="surface-tile inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm transition-colors duration-200 hover:border-surface-hover">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="font-semibold">{name}</span>
      {minutes && <span className="text-muted-foreground">· {minutes} min</span>}
    </span>
  );
}
