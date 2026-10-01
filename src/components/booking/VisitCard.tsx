import { CalendarDays, Clock, MapPin, Video } from "lucide-react";
import { StatusBadge, type ApptStatus } from "@/components/maya/StatusBadge";
import { CLINIC } from "@/lib/clinic-info";
import { fmtLongDay, fmtTime } from "@/lib/tz";
import type { ReactNode } from "react";
import { googleCalendarUrl, outlookCalendarUrl, type CalEvent } from "@/lib/ics";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type VisitSummary = {
  name: string;
  start_at: string;
  end_at: string;
  mode: "in_person" | "telehealth";
  status?: ApptStatus;
};

export function VisitCard({ visit }: { visit: VisitSummary }) {
  const tele = visit.mode === "telehealth";
  return (
    <div className="surface-tile rounded-xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-xl font-semibold">{visit.name}</h2>
        {visit.status && <StatusBadge status={visit.status} />}
      </div>
      <ul className="mt-4 space-y-2 text-base">
        <li className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          {fmtLongDay(visit.start_at)}
        </li>
        <li className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
          {fmtTime(visit.start_at)} – {fmtTime(visit.end_at)} <span className="text-muted-foreground">Central Time</span>
        </li>
        <li className="flex items-center gap-2">
          {tele ? <Video className="h-5 w-5 text-primary" aria-hidden="true" /> : <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />}
          {tele ? "Video visit — we'll send the link before your visit" : CLINIC.address}
        </li>
      </ul>
    </div>
  );
}

function toEvent(v: Pick<VisitSummary, "name" | "start_at" | "end_at" | "mode">): CalEvent {
  return {
    title: `${v.name} — ${CLINIC.name}`,
    start: v.start_at,
    end: v.end_at,
    location: v.mode === "telehealth" ? "Video visit" : CLINIC.address,
    description: `Visit with ${CLINIC.doctor}. Bring photo ID, insurance card and a list of your medicines.`,
  };
}

/** "Add to calendar" button that lets the patient pick Google or Outlook. */
export function AddToCalendar({
  visit,
  className,
  children,
}: {
  visit: Pick<VisitSummary, "name" | "start_at" | "end_at" | "mode">;
  className?: string;
  children: ReactNode;
}) {
  const ev = toEvent(visit);
  const item = "min-h-11 cursor-pointer gap-2";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={className}>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem asChild className={item}>
          <a href={googleCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">Google Calendar</a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={item}>
          <a href={outlookCalendarUrl(ev)} target="_blank" rel="noopener noreferrer">Outlook Calendar</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
