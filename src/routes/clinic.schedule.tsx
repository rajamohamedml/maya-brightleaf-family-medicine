import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AlertTriangle, Ban, ChevronLeft, ChevronRight, Loader2, Plus, Video, XCircle } from "lucide-react";
import { addBlock, getWeek, listPatients, setVisitStatus } from "@/lib/staff.functions";
import { bookAppointment } from "@/lib/booking.functions";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { StatusBadge } from "@/components/maya/StatusBadge";
import { VisitTypeChip } from "@/components/maya/VisitTypeChip";
import { SlotPicker, type PickedSlot } from "@/components/booking/SlotPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { addDays, fmtDay, fmtLongDay, fmtTime, localMinutes, localDateStr, zonedToUtc } from "@/lib/tz";
import { INSURERS, VISIT_TYPES } from "@/lib/clinic-info";
import { VISIT_SCHEDULE_COLOR, minToLabel } from "@/components/staff/visit-colors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clinic/schedule")({
  head: () => ({
    meta: [
      { title: "Schedule — Brightleaf staff" },
      { name: "description", content: "The clinic's week at a glance." },
      { property: "og:title", content: "Schedule — Brightleaf staff" },
      { property: "og:description", content: "The clinic's week at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Schedule,
});

const START = 8 * 60;
const END = 17 * 60;
const ROW = 22; // px per 15 min
const ROWS = (END - START) / 15;
const BLOCK_STYLE: Record<string, { label: string; cls: string }> = {
  lunch: { label: "Lunch", cls: "bg-muted/60 text-muted-foreground" },
  blocked: { label: "Blocked", cls: "bg-destructive-soft/70 text-foreground" },
  telehealth_only: { label: "Telehealth only", cls: "bg-accent/40 text-accent-foreground" },
  sick_hold: { label: "Sick hold", cls: "bg-warning-soft/60 text-warning" },
};
const selectCls = "min-h-11 w-full rounded-md border border-input bg-background px-3 text-foreground";
const TIMES = Array.from({ length: ROWS + 1 }, (_, i) => START + i * 15);

function Schedule() {
  const [monday, setMonday] = useState<string | undefined>();
  const [panel, setPanel] = useState<"none" | "block" | "visit">("none");
  const [openId, setOpenId] = useState<string | null>(null);
  const fetchWeek = useServerFn(getWeek);
  const q = useQuery({ queryKey: ["staff", "week", monday ?? "current"], queryFn: () => fetchWeek({ data: { monday } }) });
  const qc = useQueryClient();
  const setStatus = useServerFn(setVisitStatus);
  const cancel = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "cancelled" } }),
    onSuccess: () => {
      toast.success("Visit cancelled — the slot is open again");
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("Couldn't cancel. Please try again."),
  });

  const w = q.data;
  const days = w ? Array.from({ length: 5 }, (_, i) => addDays(w.monday, i)) : [];
  const open = w?.appts.find((a) => a.id === openId);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <h1 className="min-w-0 text-2xl font-semibold">Schedule</h1>

        <div className="flex min-w-0 items-center gap-2 sm:col-span-2 xl:col-span-1">
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Previous week" disabled={!w} onClick={() => w && setMonday(addDays(w.monday, -7))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 px-1 text-center font-semibold xl:min-w-64" aria-live="polite">
            {w ? `Week of ${fmtLongDay(zonedToUtc(w.monday, 720).toISOString())}` : "Loading week…"}
          </p>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Next week" disabled={!w} onClick={() => w && setMonday(addDays(w.monday, 7))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-2 sm:col-start-2 sm:row-start-1 sm:justify-self-end xl:col-start-3">
          <Button variant={panel === "block" ? "secondary" : "outline"} className="min-h-11" onClick={() => setPanel(panel === "block" ? "none" : "block")}>
            <Ban className="h-4 w-4" aria-hidden="true" /> Block time
          </Button>
          <Button variant={panel === "visit" ? "secondary" : "cta"} className="min-h-11" onClick={() => setPanel(panel === "visit" ? "none" : "visit")}>
            <Plus className="h-4 w-4" aria-hidden="true" /> Add visit
          </Button>
        </div>
      </div>

      {w && panel === "block" && <BlockForm days={days} onDone={() => setPanel("none")} />}
      {panel === "visit" && <AddVisitForm onDone={() => setPanel("none")} />}

      {q.isLoading ? (
        <div className="mt-4"><LoadingSkeleton rows={6} /></div>
      ) : q.error || !w ? (
        <div className="mt-4">
          <EmptyState icon={AlertTriangle} title="The schedule didn't load">
            <Button variant="outline" className="mt-3 min-h-11" onClick={() => q.refetch()}>Try again</Button>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card/20">
          <div className="grid min-w-[860px]" style={{ gridTemplateColumns: "68px repeat(5, minmax(150px, 1fr))" }}>
            <div className="sticky left-0 z-10 border-b border-border bg-background" />
            {days.map((d) => (
              <div key={d} className={cn("border-b border-l border-border px-2 py-2 text-center text-sm font-semibold", d === w.today && "text-primary")}>
                {fmtDay(zonedToUtc(d, 720).toISOString())}
              </div>
            ))}
            <div className="sticky left-0 z-10 bg-background" style={{ height: ROWS * ROW }}>
              {TIMES.slice(0, -1).map((m, i) =>
                m % 60 === 0 ? (
                  <div key={m} className="absolute right-2 text-sm text-muted-foreground" style={{ top: i * ROW - 8 }}>
                    {minToLabel(m).replace(":00", "")}
                  </div>
                ) : null,
              )}
            </div>
            {days.map((d) => (
              <div key={d} className="relative border-l border-border" style={{ height: ROWS * ROW }}>
                {Array.from({ length: ROWS }, (_, i) => (
                  <div key={i} className={cn("absolute inset-x-0 border-t", i % 4 === 0 ? "border-border" : "border-border/40")} style={{ top: i * ROW }} />
                ))}
                {w.blocks
                  .filter((b) => localDateStr(new Date(b.start_at)) === d)
                  .map((b) => {
                    const s = Math.max(localMinutes(new Date(b.start_at)), START);
                    const e = Math.min(localMinutes(new Date(b.end_at)), END);
                    const st = BLOCK_STYLE[b.kind] ?? { label: b.kind, cls: "bg-muted/60" };
                    return (
                      <div key={b.id} className={cn("absolute inset-x-0 px-1 text-sm", st.cls)} style={{ top: ((s - START) / 15) * ROW, height: ((e - s) / 15) * ROW }} title={b.note ?? st.label}>
                        <span className="font-semibold">{b.kind === "blocked" ? b.note || st.label : st.label}</span>
                      </div>
                    );
                  })}
                {w.appts
                  .filter((a) => localDateStr(new Date(a.start_at)) === d)
                  .map((a) => {
                    const s = localMinutes(new Date(a.start_at));
                    const e = localMinutes(new Date(a.end_at));
                    const done = a.status === "completed" || a.status === "no_show";
                    return (
                      <button
                        key={a.id}
                        onClick={() => setOpenId(a.id)}
                        className={cn(
                          "absolute inset-x-1 overflow-hidden rounded-md border-l-4 border-y border-r px-1.5 text-left text-sm leading-tight text-foreground transition-[filter] duration-200 hover:brightness-110",
                          VISIT_SCHEDULE_COLOR[a.visit_types?.code] ?? "bg-card border-border",
                          done && "opacity-60",
                        )}
                        style={{ top: ((s - START) / 15) * ROW + 1, height: Math.max(((e - s) / 15) * ROW - 2, ROW - 2) }}
                        aria-label={`${fmtTime(a.start_at)} ${a.visit_types?.name}, ${a.patients?.first_name} ${a.patients?.last_name}`}
                      >
                        <span className="flex items-center gap-1 font-semibold">
                          {a.mode === "telehealth" && <Video className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />}
                          <span className="truncate">{a.patients?.first_name} {a.patients?.last_name?.[0]}.</span>
                        </span>
                        {e - s >= 30 && <span className="block truncate text-muted-foreground">{a.visit_types?.name}</span>}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-2 text-sm" aria-label="Legend">
        {VISIT_TYPES.map((v) => (
          <li key={v.code} className={cn("rounded-full border-l-4 border-y border-r px-2.5 py-1 text-foreground", VISIT_SCHEDULE_COLOR[v.code])}>{v.name}</li>
        ))}
      </ul>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent>
          {open && (
            <>
              <SheetHeader>
                <SheetTitle>{open.patients?.first_name} {open.patients?.last_name}</SheetTitle>
                <SheetDescription>{fmtLongDay(open.start_at)} · {fmtTime(open.start_at)} – {fmtTime(open.end_at)}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={open.status} />
                  <VisitTypeChip name={open.visit_types?.name} mode={open.mode} />
                </div>
                <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Phone</dt><dd>{open.patients?.phone}</dd>
                  <dt className="text-muted-foreground">Insurance</dt><dd>{open.patients?.insurer}</dd>
                  <dt className="text-muted-foreground">Intake</dt><dd>{open.intake_status === "done" ? "Done" : "Missing"}</dd>
                </dl>
                {["confirmed", "reconfirmed"].includes(open.status) && (
                  <Button variant="destructive" className="min-h-11 w-full" disabled={cancel.isPending} onClick={() => cancel.mutate(open.id)}>
                    {cancel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />} Cancel visit
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function BlockForm({ days, onDone }: { days: string[]; onDone: () => void }) {
  const qc = useQueryClient();
  const add = useServerFn(addBlock);
  const [date, setDate] = useState(days[0]);
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(10 * 60);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: () => add({ data: { date, start, end, note } }),
    onSuccess: () => {
      toast.success("Time blocked");
      qc.invalidateQueries({ queryKey: ["staff"] });
      onDone();
    },
    onError: () => toast.error("Couldn't block that time. Please try again."),
  });
  const bad = end <= start;
  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!bad) m.mutate();
      }}
      className="surface-tile mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-4"
    >
      <div className="space-y-1">
        <Label htmlFor="b-day">Day</Label>
        <select id="b-day" className={selectCls} value={date} onChange={(e) => setDate(e.target.value)}>
          {days.map((d) => <option key={d} value={d}>{fmtDay(zonedToUtc(d, 720).toISOString())}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="b-start">From</Label>
        <select id="b-start" className={selectCls} value={start} onChange={(e) => setStart(Number(e.target.value))}>
          {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{minToLabel(t)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="b-end">To</Label>
        <select id="b-end" className={selectCls} value={end} onChange={(e) => setEnd(Number(e.target.value))} aria-invalid={bad}>
          {TIMES.slice(1).map((t) => <option key={t} value={t}>{minToLabel(t)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="b-note">Reason (optional)</Label>
        <Input id="b-note" className="min-h-11" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Staff meeting" />
      </div>
      {bad && <p role="alert" className="text-sm text-destructive sm:col-span-4">Pick an end time after the start time.</p>}
      <div className="flex gap-2 sm:col-span-4">
        <Button type="submit" variant="cta" className="min-h-11" disabled={m.isPending || bad}>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Block time
        </Button>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onDone}>Close</Button>
      </div>
    </form>
  );
}

type PatientRow = { id: string; first_name: string; last_name: string; dob: string; phone: string; insurer: string; is_new: boolean };

function AddVisitForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const search = useServerFn(listPatients);
  const book = useServerFn(bookAppointment);
  const [term, setTerm] = useState("");
  const [patient, setPatient] = useState<PatientRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [np, setNp] = useState({ first_name: "", last_name: "", dob: "", phone: "", email: "", insurer: INSURERS[0] });
  const [code, setCode] = useState("follow_up");
  const [mode, setMode] = useState<"in_person" | "telehealth">("in_person");
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [error, setError] = useState("");
  const pq = useQuery({ queryKey: ["staff", "patients", term], queryFn: () => search({ data: { q: term } }), enabled: !isNew && !patient });
  const vt = VISIT_TYPES.find((v) => v.code === code)!;
  const patientIsNew = isNew || !!patient?.is_new;
  const ready = (patient || (isNew && np.first_name && np.last_name && np.dob && np.phone && np.email)) && slot;

  const m = useMutation({
    mutationFn: () =>
      book({
        data: {
          patient: patient ? { dob: patient.dob, phone: patient.phone } : np,
          visit_type_code: code,
          start_at: slot!.start_at,
          mode,
          reason_category: (code === "medicare_awv" ? "physical" : code) as "physical",
          source: "staff",
        },
      }),
    onSuccess: (r) => {
      if ("ok" in r && r.ok) {
        toast.success(`Booked ${slot!.label}`);
        qc.invalidateQueries({ queryKey: ["staff"] });
        onDone();
      } else {
        setSlot(null);
        setError("message" in r ? r.message : "Couldn't book that time.");
      }
    },
    onError: () => setError("Couldn't book. Please try again."),
  });

  return (
    <div className="surface-tile mt-4 space-y-4 rounded-xl border border-border p-4">
      <h2 className="text-lg font-semibold">Add visit</h2>
      {patient ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{patient.first_name} {patient.last_name}</span>
          <span className="text-muted-foreground">{patient.dob} · {patient.insurer}{patient.is_new ? " · New" : ""}</span>
          <Button variant="ghost" className="min-h-11" onClick={() => setPatient(null)}>Change</Button>
        </div>
      ) : isNew ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["first_name", "last_name", "dob", "phone", "email"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`np-${k}`}>{{ first_name: "First name", last_name: "Last name", dob: "Date of birth", phone: "Phone", email: "Email" }[k]}</Label>
              <Input id={`np-${k}`} className="min-h-11" type={k === "dob" ? "date" : k === "email" ? "email" : "text"} value={np[k]} onChange={(e) => setNp({ ...np, [k]: e.target.value })} />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="np-ins">Insurance</Label>
            <select id="np-ins" className={selectCls} value={np.insurer} onChange={(e) => setNp({ ...np, insurer: e.target.value })}>
              {INSURERS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <Button variant="ghost" className="min-h-11 sm:col-span-2 sm:justify-self-start" onClick={() => setIsNew(false)}>Find an existing patient instead</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="p-search">Find patient</Label>
          <Input id="p-search" className="min-h-11" placeholder="Name or phone" value={term} onChange={(e) => setTerm(e.target.value)} />
          {pq.isLoading ? (
            <LoadingSkeleton rows={2} />
          ) : (
            <ul className="space-y-1">
              {(pq.data ?? []).map((p) => (
                <li key={p.id}>
                  <button className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-accent" onClick={() => setPatient(p)}>
                    <span className="font-semibold">{p.first_name} {p.last_name}</span>
                    <span className="text-sm text-muted-foreground">{p.phone}</span>
                  </button>
                </li>
              ))}
              {pq.data?.length === 0 && <li className="px-3 text-muted-foreground">No match.</li>}
            </ul>
          )}
          <Button variant="outline" className="min-h-11" onClick={() => setIsNew(true)}>New patient</Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="v-type">Visit type</Label>
          <select
            id="v-type"
            className={selectCls}
            value={code}
            onChange={(e) => {
              const v = VISIT_TYPES.find((x) => x.code === e.target.value)!;
              setCode(v.code);
              setMode(v.modes[0] ?? "in_person");
              setSlot(null);
            }}
          >
            {VISIT_TYPES.map((v) => <option key={v.code} value={v.code}>{v.name}</option>)}
          </select>
        </div>
        {vt.modes.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="v-mode">How</Label>
            <select id="v-mode" className={selectCls} value={mode} onChange={(e) => { setMode(e.target.value as typeof mode); setSlot(null); }}>
              <option value="in_person">In person</option>
              <option value="telehealth">Telehealth</option>
            </select>
          </div>
        )}
      </div>

      {(patient || isNew) && (
        <SlotPicker
          key={`${code}-${mode}-${patientIsNew}`}
          visitTypeCode={code}
          patientIsNew={patientIsNew}
          mode={mode}
          window="any"
          selected={slot}
          onSelect={(s) => { setSlot(s); setError(""); }}
          empty={<p className="text-muted-foreground">No open times for this visit type in the next 2 weeks.</p>}
        />
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button variant="cta" className="min-h-11" disabled={!ready || m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} {slot ? `Book ${slot.label}` : "Pick a time"}
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={onDone}>Close</Button>
      </div>
    </div>
  );
}
