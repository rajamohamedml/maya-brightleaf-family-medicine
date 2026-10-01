import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, CalendarCheck, CheckCircle2, ClipboardCheck, ClipboardX, Clock, Loader2, MapPin, Sparkles, UserX, Video } from "lucide-react";
import { getToday, setVisitStatus, bookRecall } from "@/lib/staff.functions";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { StatusBadge, type ApptStatus } from "@/components/maya/StatusBadge";
import { VisitTypeChip } from "@/components/maya/VisitTypeChip";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { fmtLongDay, fmtTime, zonedToUtc } from "@/lib/tz";
import { minToLabel } from "@/components/staff/visit-colors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clinic/")({
  head: () => ({
    meta: [
      { title: "Today — Brightleaf staff" },
      { name: "description", content: "Today's visits and what needs attention." },
      { property: "og:title", content: "Today — Brightleaf staff" },
      { property: "og:description", content: "Today's visits and what needs attention." },
    ],
  }),
  component: Today,
});

type Visit = any;

function Tag({ ok, okText, badText, okIcon: OkIcon, badIcon: BadIcon }: { ok: boolean; okText: string; badText: string; okIcon: typeof CheckCircle2; badIcon: typeof AlertTriangle }) {
  const Icon = ok ? OkIcon : BadIcon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-semibold", ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {ok ? okText : badText}
    </span>
  );
}

function NeutralTag({ icon: Icon, children }: { icon: typeof Video; children: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-sm font-semibold text-accent-foreground">
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </span>
  );
}

function VisitTags({ v }: { v: Visit }) {
  const live = ["confirmed", "reconfirmed", "arrived"].includes(v.status);
  return (
    <div className="flex flex-wrap gap-1.5">
      {live && <Tag ok={v.status !== "confirmed"} okText="Reconfirmed" badText="Awaiting reconfirm" okIcon={CalendarCheck} badIcon={Clock} />}
      <Tag ok={v.intake_status === "done"} okText="Intake done" badText="Intake missing" okIcon={ClipboardCheck} badIcon={ClipboardX} />
      {v.patients?.is_new && <NeutralTag icon={Sparkles}>New patient</NeutralTag>}
      {v.mode === "telehealth" && <NeutralTag icon={Video}>Telehealth</NeutralTag>}
    </div>
  );
}

function Today() {
  const fetchToday = useServerFn(getToday);
  const q = useQuery({ queryKey: ["staff", "today"], queryFn: () => fetchToday() });
  const [openId, setOpenId] = useState<string | null>(null);

  if (q.isLoading) return <LoadingSkeleton rows={5} />;
  if (q.error || !q.data)
    return (
      <EmptyState icon={AlertTriangle} title="Today didn't load">
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => q.refetch()}>Try again</Button>
      </EmptyState>
    );
  const d = q.data;
  const s = d.summary;
  const open = d.visits.find((v: Visit) => v.id === openId);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Today</h1>
      <p className="text-muted-foreground">{fmtLongDay(zonedToUtc(d.date, 12 * 60).toISOString())}</p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Visits today", s.visits],
          ["Reconfirmed", `${s.reconfirmed_pct}%`],
          ["Intake done", `${s.intake_pct}%`],
          ["Open slots left", s.open_slots],
          ["Tasks waiting", s.tasks_waiting],
        ].map(([label, val]) => (
          <div key={label as string} className="surface-tile rounded-xl border border-border p-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-2xl font-semibold">{val}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-6 text-lg font-semibold">Visits</h2>
      {d.visits.length === 0 ? (
        <div className="mt-3">
          <EmptyState icon={CalendarCheck} title="No visits today">Enjoy the quiet.</EmptyState>
        </div>
      ) : (
        <ol className="mt-3 space-y-3 border-l-2 border-border pl-4">
          {d.visits.map((v: Visit) => (
            <li key={v.id} className="relative">
              <span className="absolute -left-[23px] top-5 h-3 w-3 rounded-full bg-primary" aria-hidden="true" />
              <div className="surface-tile rounded-xl border border-border p-3 transition-colors duration-200 hover:border-surface-hover">
                <button onClick={() => setOpenId(v.id)} className="block w-full rounded-lg text-left" aria-label={`Details for ${v.patients?.first_name} ${v.patients?.last_name} at ${fmtTime(v.start_at)}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-semibold tabular-nums">{fmtTime(v.start_at)}</span>
                    <span className="font-semibold">{v.patients?.first_name} {v.patients?.last_name}</span>
                    {v.mode === "telehealth" ? <Video className="h-4 w-4 text-primary" aria-label="Telehealth" /> : <Building2 className="h-4 w-4 text-primary" aria-label="In person" />}
                    <StatusBadge status={v.status as ApptStatus} className="ml-auto" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <VisitTypeChip name={v.visit_types?.name} minutes={v.visit_types?.minutes} mode={v.mode} />
                    <VisitTags v={v} />
                  </div>
                </button>
                <VisitActions v={v} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <h2 className="mt-8 text-lg font-semibold">Tomorrow at a glance</h2>
      <div className="surface-tile mt-3 rounded-xl border border-border p-4">
        <p className="text-muted-foreground">{fmtLongDay(zonedToUtc(d.tomorrow.date, 12 * 60).toISOString())}</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-3">
          <li><span className="font-semibold">{d.tomorrow.visits}</span> visits</li>
          <li><span className="font-semibold">{d.tomorrow.reconfirmed}</span> reconfirmed</li>
          <li><span className="font-semibold">{d.tomorrow.intake_done}</span> intake done</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">Open gaps (30+ min)</p>
        {d.tomorrow.gaps.length ? (
          <ul className="mt-1 flex flex-wrap gap-2">
            {d.tomorrow.gaps.map((g: { start: number; end: number }) => (
              <li key={g.start} className="rounded-full border border-border px-3 py-1 text-sm">{minToLabel(g.start)} – {minToLabel(g.end)}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">No gaps — fully booked.</p>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="overflow-y-auto">
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.patients?.first_name} {open.patients?.last_name}</SheetTitle>
                <SheetDescription>{fmtLongDay(open.start_at)} · {fmtTime(open.start_at)} – {fmtTime(open.end_at)}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 px-4 pb-6">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={open.status} />
                  <VisitTypeChip name={open.visit_types?.name} minutes={open.visit_types?.minutes} mode={open.mode} />
                </div>
                <VisitTags v={open} />
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Date of birth</dt><dd>{open.patients?.dob}</dd>
                  <dt className="text-muted-foreground">Phone</dt><dd><a className="text-primary underline" href={`tel:${open.patients?.phone}`}>{open.patients?.phone}</a></dd>
                  <dt className="text-muted-foreground">Email</dt><dd className="break-all">{open.patients?.email}</dd>
                  <dt className="text-muted-foreground">Insurance</dt><dd>{open.patients?.insurer}</dd>
                  <dt className="text-muted-foreground">No-shows</dt><dd>{open.patients?.no_show_count}</dd>
                  <dt className="text-muted-foreground">Booked via</dt><dd className="capitalize">{open.source}</dd>
                </dl>
                <VisitActions v={open} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function VisitActions({ v }: { v: Visit }) {
  const qc = useQueryClient();
  const setStatus = useServerFn(setVisitStatus);
  const recall = useServerFn(bookRecall);
  const [askRecall, setAskRecall] = useState(false);
  const m = useMutation({
    mutationFn: (status: "arrived" | "completed" | "no_show") => setStatus({ data: { id: v.id, status } }),
    onSuccess: (_r, status) => {
      toast.success(status === "arrived" ? "Marked arrived" : status === "completed" ? "Marked completed" : "Marked no-show");
      if (status === "completed") setAskRecall(true);
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("That didn't save. Please try again."),
  });
  const r = useMutation({
    mutationFn: (months: 3 | 6 | 12) => recall({ data: { appointment_id: v.id, months } }),
    onSuccess: (res) => {
      toast.success(`Recall booked for ${res.due_date}`);
      setAskRecall(false);
    },
    onError: () => toast.error("Couldn't book the recall. Please try again."),
  });

  if (askRecall)
    return (
      <div className="mt-3 rounded-lg border border-border p-3" aria-live="polite">
        <p className="font-semibold">Book recall in:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {([3, 6, 12] as const).map((n) => (
            <Button key={n} variant="outline" className="min-h-11" disabled={r.isPending} onClick={() => r.mutate(n)}>{n} months</Button>
          ))}
          <Button variant="ghost" className="min-h-11" onClick={() => setAskRecall(false)}>None</Button>
        </div>
      </div>
    );

  const canArrive = v.status === "confirmed" || v.status === "reconfirmed";
  const canFinish = canArrive || v.status === "arrived";
  if (!canFinish) return null;
  const busy = m.isPending ? m.variables : null;
  const spin = (s: string) => busy === s && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {canArrive && (
        <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate("arrived")}>
          {spin("arrived") || <MapPin className="h-4 w-4" aria-hidden="true" />} Arrived
        </Button>
      )}
      <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate("completed")}>
        {spin("completed") || <CheckCircle2 className="h-4 w-4" aria-hidden="true" />} Completed
      </Button>
      <Button variant="ghost" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate("no_show")}>
        {spin("no_show") || <UserX className="h-4 w-4" aria-hidden="true" />} No-show
      </Button>
    </div>
  );
}
