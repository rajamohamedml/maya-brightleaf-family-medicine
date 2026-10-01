import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarX2, Star } from "lucide-react";
import { getAvailability } from "@/lib/booking.functions";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { Button } from "@/components/ui/button";
import { fmtDay, fmtTime } from "@/lib/tz";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type PickedSlot = { start_at: string; end_at: string; label: string };
export type SlotWindow = "am" | "pm" | "any";

const PER_DAY = 8;

export function WindowToggle({ value, onChange }: { value: SlotWindow; onChange: (w: SlotWindow) => void }) {
  const opts: { v: SlotWindow; label: string }[] = [
    { v: "am", label: "Morning" },
    { v: "pm", label: "Afternoon" },
    { v: "any", label: "Any time" },
  ];
  return <Segmented label="Time of day" options={opts} value={value} onChange={onChange} />;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { v: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-border p-1">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "min-h-11 rounded-md px-4 text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SlotPicker({
  visitTypeCode,
  patientIsNew,
  mode,
  window,
  excludeToken,
  selected,
  onSelect,
  empty,
}: {
  visitTypeCode: string;
  patientIsNew: boolean;
  mode: "in_person" | "telehealth";
  window: SlotWindow;
  excludeToken?: string;
  selected: PickedSlot | null;
  onSelect: (s: PickedSlot) => void;
  empty?: ReactNode;
}) {
  const fetchSlots = useServerFn(getAvailability);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = useQuery({
    queryKey: ["availability", visitTypeCode, patientIsNew, mode, window, excludeToken],
    queryFn: () =>
      fetchSlots({ data: { visit_type_code: visitTypeCode, patient_is_new: patientIsNew, mode, window, days: 14, exclude_token: excludeToken } }),
  });

  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  if (q.isError)
    return (
      <div role="alert" className="popup-alert p-4">
        <p>We couldn't load open times.</p>
        <Button variant="outline" className="mt-3" onClick={() => q.refetch()}>Try again</Button>
      </div>
    );
  const res = q.data!;
  if ("error" in res) return <p role="alert" className="popup-alert p-4">{res.message}</p>;
  if (res.total === 0)
    return (
      <EmptyState icon={CalendarX2} title="No open times in the next 2 weeks">
        {empty}
      </EmptyState>
    );

  const firstStart = res.groups[0]?.slots[0]?.start_at;
  return (
    <div className="space-y-6">
      {res.groups.map((g) => {
        const show = expanded[g.date] ? g.slots : g.slots.slice(0, PER_DAY);
        return (
          <section key={g.date} aria-label={fmtDay(g.slots[0]!.start_at)}>
            <h3 className="text-base font-semibold">{fmtDay(g.slots[0]!.start_at)}</h3>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {show.map((s) => {
                const isSel = selected?.start_at === s.start_at;
                const isFirst = s.start_at === firstStart;
                return (
                  <button
                    key={s.start_at}
                    type="button"
                    aria-pressed={isSel}
                    aria-label={`${s.label}${isFirst ? ", first available" : ""}`}
                    onClick={() => onSelect(s)}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center rounded-lg border px-2 py-2 text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSel
                        ? "border-primary bg-primary text-primary-foreground"
                        : isFirst
                          ? "border-primary bg-accent text-foreground hover:border-surface-hover"
                          : "border-border hover:border-surface-hover",
                    )}
                  >
                    {fmtTime(s.start_at)}
                    {isFirst && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-sm font-normal">
                        <Star className="h-3.5 w-3.5" aria-hidden="true" /> First available
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {g.slots.length > PER_DAY && !expanded[g.date] && (
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => setExpanded((e) => ({ ...e, [g.date]: true }))}>
                Show {g.slots.length - PER_DAY} more times
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
