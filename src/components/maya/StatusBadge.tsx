import { AlertTriangle, CheckCircle2, CircleCheckBig, Clock, MapPin, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ApptStatus = "confirmed" | "reconfirmed" | "arrived" | "completed" | "cancelled" | "released" | "no_show";

const MAP: Record<ApptStatus, { label: string; icon: LucideIcon; cls: string }> = {
  confirmed: { label: "Confirmed", icon: CheckCircle2, cls: "bg-success-soft text-success" },
  reconfirmed: { label: "Reconfirmed", icon: CircleCheckBig, cls: "bg-success-soft text-success" },
  arrived: { label: "Arrived", icon: MapPin, cls: "bg-accent text-accent-foreground" },
  completed: { label: "Completed", icon: CheckCircle2, cls: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", icon: XCircle, cls: "bg-muted text-muted-foreground" },
  released: { label: "Released", icon: Clock, cls: "bg-warning-soft text-warning" },
  no_show: { label: "No-show", icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
};

export function StatusBadge({ status, className }: { status: ApptStatus; className?: string }) {
  const s = MAP[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold", s.cls, className)}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {s.label}
    </span>
  );
}
