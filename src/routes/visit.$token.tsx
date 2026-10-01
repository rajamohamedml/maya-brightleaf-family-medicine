import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarPlus, CalendarX2, CheckCircle2, ClipboardCheck, ClipboardList, Loader2 } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { VisitCard, addVisitToCalendar } from "@/components/booking/VisitCard";
import { SlotPicker, WindowToggle, type PickedSlot, type SlotWindow } from "@/components/booking/SlotPicker";
import { manageAppointment } from "@/lib/booking.functions";

export const Route = createFileRoute("/visit/$token")({
  head: () => ({
    meta: [
      { title: "Your visit — Brightleaf Family Medicine" },
      { name: "description", content: "See, confirm, move or cancel your visit." },
      { property: "og:title", content: "Your visit — Brightleaf Family Medicine" },
      { property: "og:description", content: "See, confirm, move or cancel your visit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VisitPage,
});

function VisitPage() {
  const { token } = Route.useParams();
  const manage = useServerFn(manageAppointment);
  const qc = useQueryClient();
  const key = ["visit", token];
  const q = useQuery({ queryKey: key, queryFn: () => manage({ data: { token, action: "view" } }) });
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [win, setWin] = useState<SlotWindow>("any");
  const [slot, setSlot] = useState<PickedSlot | null>(null);

  async function act(action: "reconfirm" | "cancel" | "reschedule", ok: string) {
    setBusy(action);
    try {
      const res = await manage({ data: { token, action, new_start_at: action === "reschedule" ? slot?.start_at : undefined } });
      if ("error" in res) {
        toast.error(res.message);
        if (res.error === "slot_taken") { setSlot(null); qc.invalidateQueries({ queryKey: ["availability"] }); }
        return;
      }
      qc.setQueryData(key, res);
      qc.invalidateQueries({ queryKey: ["availability"] });
      setMoving(false);
      setSlot(null);
      toast.success(ok);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  let body;
  if (q.isLoading) body = <LoadingSkeleton rows={3} />;
  else if (q.isError) body = <EmptyState icon={CalendarX2} title="We couldn't load your visit"><Button variant="outline" className="mt-3" onClick={() => q.refetch()}>Try again</Button></EmptyState>;
  else if (!q.data || !("visit" in q.data) || !q.data.visit) body = <EmptyState icon={CalendarX2} title="Visit not found">{q.data && "message" in q.data ? q.data.message : null}</EmptyState>;
  else {
    const v = q.data.visit;
    const visit = { name: v.visit_name, start_at: v.start_at, end_at: v.end_at, mode: v.mode, status: v.status };
    body = (
      <div className="mx-auto max-w-xl space-y-5" aria-live="polite">
        <VisitCard visit={visit} />
        {v.can_change && (
          <div className="flex flex-col gap-3">
            {v.status === "confirmed" && (
              <Button variant="cta" size="lg" disabled={!!busy} onClick={() => act("reconfirm", "Thanks! See you then.")}>
                {busy === "reconfirm" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} I'll be there
              </Button>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Button variant="outline" onClick={() => setMoving((m) => !m)} aria-expanded={moving}>Reschedule</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline">Cancel visit</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this visit?</AlertDialogTitle>
                    <AlertDialogDescription>The time will open up for someone else. You can book again any time.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep my visit</AlertDialogCancel>
                    <AlertDialogAction className="border border-border bg-transparent text-foreground hover:bg-transparent hover:text-primary" onClick={() => act("cancel", "Your visit is cancelled.")}>Yes, cancel my visit</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={() => addVisitToCalendar(visit)}><CalendarPlus /> Add to calendar</Button>
            </div>
          </div>
        )}
        {!v.can_change && v.status === "cancelled" && (
          <Button asChild variant="cta" size="lg" className="w-full"><Link to="/book">Book a new visit</Link></Button>
        )}

        {moving && (
          <section className="rounded-xl border border-border p-4">
            <h2 className="text-lg font-semibold">Choose a new time</h2>
            <div className="my-4"><WindowToggle value={win} onChange={(w) => { setWin(w); setSlot(null); }} /></div>
            <SlotPicker visitTypeCode={v.visit_type_code} patientIsNew={v.patient_is_new} mode={v.mode} window={win} excludeToken={token} selected={slot} onSelect={setSlot} />
            <Button variant="cta" size="lg" className="mt-5 w-full sm:w-auto" disabled={!slot || !!busy} onClick={() => act("reschedule", "Your visit has moved.")}>
              {busy === "reschedule" && <Loader2 className="animate-spin" />} {slot ? `Move to ${slot.label}` : "Pick a time above"}
            </Button>
          </section>
        )}

        {!["cancelled", "completed", "released", "no_show"].includes(v.status) && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
          {v.intake_status === "done" ? (
            <p className="flex items-center gap-2 text-success"><ClipboardCheck className="h-5 w-5" aria-hidden="true" /> Intake form done</p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-warning"><ClipboardList className="h-5 w-5" aria-hidden="true" /> Intake form not done yet</p>
              <Button asChild variant="outline"><Link to="/intake/$token" params={{ token }}>Complete intake</Link></Button>
            </>
          )}
        </div>}
      </div>
    );
  }

  const name = q.data && "visit" in q.data && q.data.visit ? q.data.visit.first_name : "";
  return (
    <PageShell>
      <h1 className="mx-auto mb-5 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{name ? `Hi ${name}, here's your visit` : "Your visit"}</h1>
      <div className="mx-auto max-w-xl">{body}</div>
    </PageShell>
  );
}
