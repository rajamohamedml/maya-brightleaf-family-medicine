import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertOctagon,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  Loader2,
  MessageSquare,
  Phone,
  Settings2,
  Stethoscope,
  Thermometer,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Field, SelectField } from "@/components/booking/Field";
import { Segmented, SlotPicker, WindowToggle, type PickedSlot, type SlotWindow } from "@/components/booking/SlotPicker";
import { VisitCard, addVisitToCalendar, type VisitSummary } from "@/components/booking/VisitCard";
import {
  bookAppointment,
  createTask,
  joinWaitlist,
  lookupPatient,
  resolveVisit,
  upsertLead,
} from "@/lib/booking.functions";
import { EMERGENCY_MESSAGE, INSURER_OPTIONS, REASONS, SAFETY_QUESTION, WHAT_TO_BRING, type ReasonKey } from "@/lib/booking-rules";
import { fmtSlot } from "@/lib/tz";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a visit — Brightleaf Family Medicine" },
      { name: "description", content: "Book a visit with Dr. Rahman in about 2 minutes." },
      { property: "og:title", content: "Book a visit — Brightleaf Family Medicine" },
      { property: "og:description", content: "Book a visit with Dr. Rahman in about 2 minutes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BookPage,
});

type Step = 1 | 2 | 3 | 4 | 5;
type Mode = "in_person" | "telehealth";
type Resolved = {
  code: string;
  name: string;
  minutes: number;
  modes: Mode[];
  patient_is_new: boolean;
  eligibility: string | null;
  eligibility_message: string | null;
};
const STEP_NAMES = ["reason", "safety", "patient", "choose_time", "review"] as const;
const REASON_ICONS: Record<ReasonKey, LucideIcon> = {
  physical: Stethoscope,
  new_patient: UserPlus,
  follow_up: HeartPulse,
  sick: Thermometer,
  telehealth: Video,
  other: ClipboardList,
};

const digits = (s: string) => s.replace(/\D/g, "");
const validDob = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && s > "1900-01-01" && new Date(s) < new Date();

function BookPage() {
  const [step, setStep] = useState<Step>(1);
  const [reason, setReason] = useState<ReasonKey | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [kind, setKind] = useState<"new" | "returning" | null>(null);
  const [ret, setRet] = useState({ dob: "", phone: "" });
  const [welcome, setWelcome] = useState<string | null>(null);
  const [np, setNp] = useState({ first_name: "", last_name: "", dob: "", phone: "", email: "", insurer: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [visit, setVisit] = useState<Resolved | null>(null);
  const [mode, setMode] = useState<Mode>("in_person");
  const [win, setWin] = useState<SlotWindow>("any");
  const [slot, setSlot] = useState<PickedSlot | null>(null);
  const [alts, setAlts] = useState<PickedSlot[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [leadId, setLeadId] = useState<string>();
  const [booked, setBooked] = useState<{ token: string; visit: VisitSummary } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const lookupFn = useServerFn(lookupPatient);
  const resolveFn = useServerFn(resolveVisit);
  const bookFn = useServerFn(bookAppointment);
  const leadFn = useServerFn(upsertLead);
  const taskFn = useServerFn(createTask);
  const waitFn = useServerFn(joinWaitlist);

  // Track progress as a lead so unfinished bookings can be nudged later.
  useEffect(() => {
    if (!reason || reason === "other" || booked || emergency) return;
    leadFn({
      data: {
        id: leadId,
        step_reached: STEP_NAMES[step - 1],
        reason_category: reason,
        ...(kind === "new" ? { first_name: np.first_name, last_name: np.last_name, phone: np.phone, email: np.email } : {}),
      },
    })
      .then((r) => setLeadId(r.id))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reason]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, emergency, booked, done]);

  const go = (s: Step) => {
    setErrors({});
    setStep(s);
  };

  async function resolve(r: Exclude<ReasonKey, "other">) {
    const res = await resolveFn({
      data: { reason: r, ...(kind === "returning" ? { returning: ret } : { insurer: np.insurer }) },
    });
    if ("error" in res) {
      setErrors({ form: res.message });
      return false;
    }
    setVisit(res);
    setMode(res.modes[0]);
    setSlot(null);
    return true;
  }

  async function submitPatient() {
    const e: Record<string, string> = {};
    if (kind === "returning") {
      if (!validDob(ret.dob)) e.dob = "Enter your date of birth";
      if (digits(ret.phone).length < 10) e.phone = "Enter your 10-digit phone number";
    } else {
      if (!np.first_name.trim()) e.first_name = "Enter your first name";
      if (!np.last_name.trim()) e.last_name = "Enter your last name";
      if (!validDob(np.dob)) e.dob = "Enter your date of birth";
      if (digits(np.phone).length < 10) e.phone = "Enter your 10-digit phone number";
      if (!/^\S+@\S+\.\S+$/.test(np.email)) e.email = "Enter an email like name@example.com";
      if (!np.insurer) e.insurer = "Choose your insurance";
    }
    setErrors(e);
    if (Object.keys(e).length || np.insurer === "Medicaid") return;
    setBusy(true);
    try {
      if (kind === "returning") {
        const r = await lookupFn({ data: ret });
        if (!r.exists) {
          setErrors({ form: "We couldn't find you with that birth date and phone. Check them, or book as a new patient." });
          return;
        }
        setWelcome(r.first_name);
      }
      if (await resolve(reason as Exclude<ReasonKey, "other">)) go(4);
    } catch {
      setErrors({ form: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function switchReason(r: Exclude<ReasonKey, "other">) {
    setReason(r);
    setBusy(true);
    await resolve(r).finally(() => setBusy(false));
  }

  const patientPayload = () =>
    kind === "returning"
      ? { dob: ret.dob, phone: ret.phone }
      : { ...np, first_name: np.first_name.trim(), last_name: np.last_name.trim() };

  async function book() {
    if (!visit || !slot || !reason || reason === "other") return;
    if (!consent) {
      setErrors({ consent: "Please tick the box to continue" });
      return;
    }
    setBusy(true);
    setAlts(null);
    try {
      const res = await bookFn({
        data: {
          patient: patientPayload(),
          visit_type_code: visit.code,
          start_at: slot.start_at,
          mode,
          reason_category: reason,
          source: "form",
          lead_id: leadId,
        },
      });
      if ("error" in res) {
        if (res.error === "slot_taken" && "alternatives" in res) {
          setAlts(res.alternatives as PickedSlot[]);
          setSlot(null);
        }
        setErrors({ form: res.message });
        return;
      }
      setBooked({ token: res.token, visit: { ...res.visit, name: res.visit.name } });
      toast.success("You're booked!");
    } catch {
      setErrors({ form: "We couldn't book that. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function requestCallback() {
    setBusy(true);
    try {
      await taskFn({ data: { name: `${np.first_name} ${np.last_name}`.trim() || "Patient", phone: np.phone, kind: "callback", details: "Medicaid — asked for a callback" } });
      setDone("Thanks! Our team will call you within 1 business day.");
      toast.success("Callback requested");
    } catch {
      toast.error("Please enter your name and phone number first.");
    } finally {
      setBusy(false);
    }
  }

  async function joinWait() {
    if (!visit) return;
    setBusy(true);
    try {
      const res = await waitFn({ data: { patient: patientPayload(), visit_type_codes: [visit.code], window: win } });
      if ("error" in res) return toast.error(res.message);
      setDone("You're on the waitlist. We'll text you if an earlier time opens up.");
      toast.success("Added to the waitlist");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- terminal screens ---------- */
  if (emergency)
    return (
      <PageShell>
        <div role="alert" className="mx-auto max-w-xl rounded-xl border-4 border-destructive p-6 text-center sm:p-10">
          <AlertOctagon className="mx-auto h-14 w-14 text-destructive" aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-3xl font-semibold outline-none">{EMERGENCY_MESSAGE}</h1>
          <p className="mt-3 text-muted-foreground">Please don't wait for a booking. Get help right away.</p>
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild variant="destructive" size="lg"><a href="tel:911"><Phone /> Call 911</a></Button>
            <Button asChild variant="outline" size="lg"><a href="tel:988">Call or text 988</a></Button>
            <Button variant="ghost" onClick={() => setEmergency(false)}><ArrowLeft /> Back</Button>
          </div>
        </div>
      </PageShell>
    );

  if (booked)
    return (
      <PageShell>
        <div className="mx-auto max-w-xl space-y-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-success" aria-hidden="true" />
            <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-3xl font-semibold outline-none" aria-live="polite">
              You're booked — confirmed
            </h1>
            <p className="mt-2 text-muted-foreground">We sent the details to your email.</p>
          </div>
          <VisitCard visit={{ ...booked.visit, status: "confirmed" }} />
          <div className="rounded-xl border border-border p-4">
            <h2 className="font-semibold">Please bring</h2>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">{WHAT_TO_BRING.map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild variant="cta" size="lg"><Link to="/intake/$token" params={{ token: booked.token }}>Complete intake now</Link></Button>
            <Button variant="outline" size="lg" onClick={() => addVisitToCalendar(booked.visit)}><CalendarPlus /> Add to calendar</Button>
            <Button asChild variant="outline" size="lg"><Link to="/visit/$token" params={{ token: booked.token }}><Settings2 /> Manage my visit</Link></Button>
          </div>
        </div>
      </PageShell>
    );

  if (done)
    return (
      <PageShell>
        <div className="mx-auto max-w-xl text-center" aria-live="polite">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-semibold outline-none">{done}</h1>
          <Button asChild variant="outline" className="mt-6"><Link to="/">Back to home</Link></Button>
        </div>
      </PageShell>
    );

  /* ---------- wizard ---------- */
  const reasonLabel = REASONS.find((r) => r.key === reason)?.label;
  const patientName = kind === "returning" ? welcome : np.first_name ? `${np.first_name} ${np.last_name}` : null;
  const summary: [string, string | null | undefined][] = [
    ["Reason", reasonLabel],
    ["Patient", patientName],
    ["Visit", visit ? `${visit.name} · ${visit.minutes} min` : null],
    ["How", visit ? (mode === "telehealth" ? "Video visit" : "In person") : null],
    ["Time", slot?.label],
  ];

  return (
    <PageShell>
      <div className="mx-auto max-w-[1100px] pb-28 lg:pb-0">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Step {step} of 5</p>
          <Progress value={(step / 5) * 100} className="mt-2 h-2" aria-label={`Step ${step} of 5`} />
        </div>
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            {step > 1 && (
              <Button variant="ghost" className="-ml-3 mb-2" onClick={() => go((step - 1) as Step)}>
                <ArrowLeft /> Back
              </Button>
            )}

            {step === 1 && reason !== "other" && (
              <StepBody title="What brings you in?" headingRef={headingRef}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {REASONS.map((r) => {
                    const Icon = REASON_ICONS[r.key];
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => {
                          setReason(r.key);
                          setVisit(null);
                          setSlot(null);
                          if (r.key !== "other") go(2);
                        }}
                        className="surface-tile flex min-h-20 items-center gap-4 rounded-xl border border-border p-4 text-left transition-colors duration-150 hover:border-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon className="h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
                        <span>
                          <span className="block text-lg font-semibold">{r.label}</span>
                          <span className="block text-sm text-muted-foreground">{r.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </StepBody>
            )}

            {step === 1 && reason === "other" && (
              <OtherRequest headingRef={headingRef} onBack={() => setReason(null)} onDone={setDone} />
            )}

            {step === 2 && (
              <StepBody title="A quick safety check" headingRef={headingRef}>
                <p className="text-xl">{SAFETY_QUESTION}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" size="lg" className="border-destructive text-base" onClick={() => setEmergency(true)}>Yes</Button>
                  <Button variant="cta" size="lg" onClick={() => go(3)}>No</Button>
                </div>
              </StepBody>
            )}

            {step === 3 && (
              <StepBody title="Have you been to Brightleaf before?" headingRef={headingRef}>
                <Segmented
                  label="New or returning patient"
                  options={[{ v: "returning", label: "I've been before" }, { v: "new", label: "I'm new" }]}
                  value={kind ?? ("" as "new")}
                  onChange={(v) => { setKind(v); setErrors({}); }}
                />
                {kind === "returning" && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field id="r-dob" label="Date of birth" type="date" value={ret.dob} error={errors.dob} onChange={(e) => setRet({ ...ret, dob: e.target.value })} />
                    <Field id="r-phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="214-555-0123" value={ret.phone} error={errors.phone} onChange={(e) => setRet({ ...ret, phone: e.target.value })} />
                  </div>
                )}
                {kind === "new" && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Field id="n-first" label="First name" autoComplete="given-name" value={np.first_name} error={errors.first_name} onChange={(e) => setNp({ ...np, first_name: e.target.value })} />
                    <Field id="n-last" label="Last name" autoComplete="family-name" value={np.last_name} error={errors.last_name} onChange={(e) => setNp({ ...np, last_name: e.target.value })} />
                    <Field id="n-dob" label="Date of birth" type="date" value={np.dob} error={errors.dob} onChange={(e) => setNp({ ...np, dob: e.target.value })} />
                    <Field id="n-phone" label="Phone number" type="tel" autoComplete="tel" inputMode="tel" placeholder="214-555-0123" value={np.phone} error={errors.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
                    <Field id="n-email" label="Email" type="email" autoComplete="email" value={np.email} error={errors.email} onChange={(e) => setNp({ ...np, email: e.target.value })} />
                    <SelectField id="n-ins" label="Insurance" placeholder="Choose one" value={np.insurer} error={errors.insurer} onChange={(v) => setNp({ ...np, insurer: v })} options={INSURER_OPTIONS.map((i) => ({ value: i, label: i }))} />
                  </div>
                )}
                {kind === "new" && np.insurer === "Medicaid" && (
                  <div role="status" className="mt-6 rounded-xl border border-warning p-4">
                    <p className="text-lg">We're sorry — we're not able to accept Medicaid at this time.</p>
                    <p className="mt-1 text-muted-foreground">We can call you to help find another option.</p>
                    <Button variant="cta" className="mt-4" disabled={busy || digits(np.phone).length < 10} onClick={requestCallback}>
                      {busy && <Loader2 className="animate-spin" />} Request a callback
                    </Button>
                    {digits(np.phone).length < 10 && <p className="mt-2 text-sm text-muted-foreground">Add your name and phone above first.</p>}
                  </div>
                )}
                <FormError msg={errors.form} />
                {kind && np.insurer !== "Medicaid" && (
                  <ActionBar><Button variant="cta" size="lg" className="w-full sm:w-auto" disabled={busy} onClick={submitPatient}>{busy && <Loader2 className="animate-spin" />} Continue</Button></ActionBar>
                )}
                {kind === "returning" && errors.form && (
                  <Button variant="link" onClick={() => { setKind("new"); setErrors({}); }}>Book as a new patient</Button>
                )}
              </StepBody>
            )}

            {step === 4 && visit && (
              <StepBody title={welcome ? `Welcome back, ${welcome}. Pick a time.` : "Pick a time"} headingRef={headingRef}>
                <p className="text-muted-foreground">{visit.name} · {visit.minutes} minutes</p>
                {visit.eligibility ? (
                  <div role="status" className="mt-4 rounded-xl border border-warning p-4">
                    <p>{visit.eligibility_message}</p>
                    {visit.eligibility === "established_only" && (
                      <Button variant="cta" className="mt-4" disabled={busy} onClick={() => switchReason("new_patient")}>Book a New patient visit instead</Button>
                    )}
                    {visit.eligibility === "new_only" && (
                      <Button variant="cta" className="mt-4" disabled={busy} onClick={() => switchReason("follow_up")}>Book a follow-up instead</Button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="my-5 flex flex-wrap gap-3">
                      {visit.modes.length > 1 && (
                        <Segmented label="Visit type" options={[{ v: "in_person", label: "In person" }, { v: "telehealth", label: "Video" }]} value={mode} onChange={(m) => { setMode(m); setSlot(null); }} />
                      )}
                      <WindowToggle value={win} onChange={(w) => { setWin(w); setSlot(null); }} />
                    </div>
                    <SlotPicker
                      visitTypeCode={visit.code}
                      patientIsNew={visit.patient_is_new}
                      mode={mode}
                      window={win}
                      selected={slot}
                      onSelect={setSlot}
                      empty={
                        <Button variant="cta" className="mt-4" disabled={busy} onClick={joinWait}>
                          {busy && <Loader2 className="animate-spin" />} Join the waitlist for an earlier time
                        </Button>
                      }
                    />
                    <ActionBar><Button variant="cta" size="lg" className="w-full sm:w-auto" disabled={!slot} onClick={() => go(5)}>Continue</Button></ActionBar>
                  </>
                )}
              </StepBody>
            )}

            {step === 5 && visit && (
              <StepBody title="Check and book" headingRef={headingRef}>
                {slot && <VisitCard visit={{ name: visit.name, start_at: slot.start_at, end_at: slot.end_at, mode }} />}
                <dl className="mt-4 grid gap-2 rounded-xl border border-border p-4 sm:grid-cols-[140px_1fr]">
                  <dt className="text-muted-foreground">Reason</dt><dd>{reasonLabel}</dd>
                  <dt className="text-muted-foreground">Patient</dt><dd>{patientName}</dd>
                  {kind === "new" && (<><dt className="text-muted-foreground">Birth date</dt><dd>{np.dob}</dd>
                  <dt className="text-muted-foreground">Phone</dt><dd>{np.phone}</dd>
                  <dt className="text-muted-foreground">Email</dt><dd className="break-all">{np.email}</dd>
                  <dt className="text-muted-foreground">Insurance</dt><dd>{np.insurer}</dd></>)}
                </dl>
                {alts && alts.length > 0 && (
                  <div className="mt-4" aria-live="polite">
                    <p className="font-semibold">Next open times</p>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {alts.map((a) => (
                        <Button key={a.start_at} variant={slot?.start_at === a.start_at ? "default" : "outline"} onClick={() => { setSlot(a); setErrors({}); }}>{a.label}</Button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="mt-6 flex items-start gap-3">
                  <Checkbox id="consent" checked={consent} onCheckedChange={(v) => { setConsent(v === true); setErrors({}); }} className="mt-1 h-6 w-6" aria-describedby={errors.consent ? "consent-err" : undefined} />
                  <Label htmlFor="consent" className="text-base leading-snug">This is a demo; I have not entered real health information.</Label>
                </div>
                {errors.consent && <p id="consent-err" className="mt-1 text-sm text-warning">{errors.consent}</p>}
                <FormError msg={errors.form} />
                <ActionBar><Button variant="cta" size="lg" className="w-full sm:w-auto" disabled={busy || !slot} onClick={book}>{busy && <Loader2 className="animate-spin" />} Book my visit</Button></ActionBar>
              </StepBody>
            )}
          </div>

          <SummaryCard items={summary} />
        </div>
      </div>
    </PageShell>
  );
}

function StepBody({ title, headingRef, children }: { title: string; headingRef: React.RefObject<HTMLHeadingElement | null>; children: ReactNode }) {
  return (
    <section>
      <h1 ref={headingRef} tabIndex={-1} className="mb-5 text-2xl font-semibold outline-none sm:text-3xl">{title}</h1>
      {children}
    </section>
  );
}

function ActionBar({ children }: { children: ReactNode }) {
  return <div className="mt-6">{children}</div>;
}

function FormError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="alert" className="mt-4 rounded-lg border border-warning p-3 text-warning">{msg}</p>;
}

function SummaryCard({ items }: { items: [string, string | null | undefined][] }) {
  const filled = items.filter(([, v]) => v);
  const list = (
    <dl className="space-y-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={cn("text-right font-semibold", !v && "font-normal text-muted-foreground")}>{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <>
      <aside className="hidden lg:block">
        <div className="surface-tile sticky top-24 rounded-xl border border-border p-5">
          <h2 className="mb-3 font-semibold">Your visit</h2>
          {list}
        </div>
      </aside>
      <details className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur lg:hidden">
        <summary className="flex min-h-14 cursor-pointer items-center justify-between px-4 font-semibold">
          <span>Your visit</span>
          <span className="text-sm font-normal text-muted-foreground">{filled.length} of {items.length} chosen · tap to view</span>
        </summary>
        <div className="max-h-[50vh] overflow-auto px-4 pb-4">{list}</div>
      </details>
    </>
  );
}

function OtherRequest({ headingRef, onBack, onDone }: { headingRef: React.RefObject<HTMLHeadingElement | null>; onBack: () => void; onDone: (m: string) => void }) {
  const taskFn = useServerFn(createTask);
  const [f, setF] = useState({ name: "", phone: "", kind: "", details: "" });
  const [e, setE] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit() {
    const errs: Record<string, string> = {};
    if (f.name.trim().length < 2) errs.name = "Enter your name";
    if (digits(f.phone).length < 10) errs.phone = "Enter your 10-digit phone number";
    if (!f.kind) errs.kind = "Choose what you need";
    setE(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await taskFn({ data: { name: f.name, phone: f.phone, kind: f.kind as "refill", details: f.details } });
      toast.success("Request sent");
      onDone("Got it! We'll reply within 1 business day.");
    } catch {
      setE({ form: "We couldn't send that. Please try again." });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <Button variant="ghost" className="-ml-3 mb-2" onClick={onBack}><ArrowLeft /> Back</Button>
      <h1 ref={headingRef} tabIndex={-1} className="mb-2 text-2xl font-semibold outline-none sm:text-3xl">How can we help?</h1>
      <p className="mb-5 flex items-center gap-2 text-muted-foreground"><MessageSquare className="h-4 w-4" aria-hidden="true" /> Our team will get back to you. Please don't include health details.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="o-name" label="Your name" autoComplete="name" value={f.name} error={e.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} />
        <Field id="o-phone" label="Phone number" type="tel" autoComplete="tel" value={f.phone} error={e.phone} onChange={(ev) => setF({ ...f, phone: ev.target.value })} />
        <SelectField id="o-kind" label="What do you need?" placeholder="Choose one" value={f.kind} error={e.kind} onChange={(v) => setF({ ...f, kind: v })}
          options={[{ value: "refill", label: "Prescription refill" }, { value: "records", label: "Medical records" }, { value: "billing", label: "Billing question" }]} />
        <Field id="o-note" label="Short note (optional)" maxLength={120} value={f.details} onChange={(ev) => setF({ ...f, details: ev.target.value })} />
      </div>
      <FormError msg={e.form} />
      <ActionBar><Button variant="cta" size="lg" className="w-full sm:w-auto" disabled={busy} onClick={submit}>{busy && <Loader2 className="animate-spin" />} Send request</Button></ActionBar>
      <p className="mt-3 text-sm text-muted-foreground">Prefer to book? <button type="button" className="text-primary underline" onClick={onBack}>Pick another reason</button>. {fmtSlot.length ? "" : ""}</p>
    </section>
  );
}
