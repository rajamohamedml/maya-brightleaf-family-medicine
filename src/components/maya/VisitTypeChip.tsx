import { Building2, Video } from "lucide-react";
import type { VisitMode } from "@/lib/clinic-info";

export function VisitTypeChip({ name, minutes, mode }: { name: string; minutes?: number; mode: VisitMode }) {
  const Icon = mode === "telehealth" ? Video : Building2;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-sm">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="font-semibold">{name}</span>
      {minutes && <span className="text-muted-foreground">· {minutes} min</span>}
    </span>
  );
}
