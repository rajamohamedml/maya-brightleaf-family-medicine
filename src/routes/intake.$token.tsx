import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarX2, CheckCircle2, Loader2 } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, type FormErrors } from "@/components/booking/Field";
import { manageAppointment, submitIntake } from "@/lib/booking.functions";
import { fmtSlot } from "@/lib/tz";

export const Route = createFileRoute("/intake/$token")({
  head: () => ({
    meta: [
      { title: "Intake form — Brightleaf Family Medicine" },
      { name: "description", content: "Finish a few details before your visit." },
      { property: "og:title", content: "Intake form — Brightleaf Family Medicine" },
      { property: "og:description", content: "Finish a few details before your visit." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: IntakePage,
});

function IntakePage() {
  const { token } = Route.useParams();
  const view = useServerFn(manageAppointment);
  const submit = useServerFn(submitIntake);
  const q = useQuery({ queryKey: ["visit", token], queryFn: () => view({ data: { token, action: "view" } }) });
  const [f, setF] = useState({ address: "", emergency_name: "", emergency_phone: "", pharmacy: "", medications: "", medications_none: false, allergies: "", allergies_none: false, consent: false });
  const [e, setE] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs: FormErrors = {};
    if (f.address.trim().length < 5) errs.address = "Enter your home address";
    if (f.emergency_name.trim().length < 2) errs.emergency_name = "Enter a contact name";
    if (f.emergency_phone.replace(/\D/g, "").length < 10) errs.emergency_phone = "Enter a 10-digit phone number";
    if (f.pharmacy.trim().length < 2) errs.pharmacy = "Enter your pharmacy";
    if (!f.medications_none && !f.medications.trim()) errs.medications = "List your medicines, or tick None";
    if (!f.allergies_none && !f.allergies.trim()) errs.allergies = "List your allergies, or tick None";
    if (!f.consent) errs.consent = "Please tick the box to continue";
    setE(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await submit({ data: { token, data: { ...f, consent: true } } });
      if ("error" in res) { toast.error(res.message); return; }
      setSent(true);
      toast.success("Intake form sent");
    } catch {
      toast.error("We couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) return <PageShell title="Intake form"><LoadingSkeleton rows={4} /></PageShell>;
  if (q.isError || !q.data || !("visit" in q.data) || !q.data.visit)
    return <PageShell title="Intake form"><EmptyState icon={CalendarX2} title="Visit not found">Please check your link.</EmptyState></PageShell>;
  const v = q.data.visit;

  if (sent || v.intake_status === "done")
    return (
      <PageShell>
        <div className="mx-auto max-w-xl text-center" aria-live="polite">
          <CheckCircle2 className="mx-auto h-16 w-16 text-success" aria-hidden="true" />
          <h1 className="mt-3 text-3xl font-semibold">Thank you, {v.first_name}!</h1>
          <p className="mt-2 text-muted-foreground">Your intake form is done. See you {fmtSlot(v.start_at)}.</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/visit/$token" params={{ token }}>View my visit</Link></Button>
        </div>
      </PageShell>
    );

  const noneBox = (key: "medications_none" | "allergies_none", id: string) => (
    <div className="flex items-center gap-3">
      <Checkbox id={id} checked={f[key]} onCheckedChange={(c) => setF({ ...f, [key]: c === true })} className="h-6 w-6" />
      <Label htmlFor={id} className="text-base">None</Label>
    </div>
  );

  return (
    <PageShell title="Intake form" intro={`${v.visit_name} · ${fmtSlot(v.start_at)}. Takes about 2 minutes.`}>
      <form onSubmit={onSubmit} noValidate className="mx-auto max-w-xl space-y-5">
        <Field id="i-address" label="Home address" autoComplete="street-address" value={f.address} error={e.address} onChange={(ev) => setF({ ...f, address: ev.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="i-ename" label="Emergency contact name" value={f.emergency_name} error={e.emergency_name} onChange={(ev) => setF({ ...f, emergency_name: ev.target.value })} />
          <Field id="i-ephone" label="Emergency contact phone" type="tel" value={f.emergency_phone} error={e.emergency_phone} onChange={(ev) => setF({ ...f, emergency_phone: ev.target.value })} />
        </div>
        <Field id="i-pharm" label="Preferred pharmacy" value={f.pharmacy} error={e.pharmacy} onChange={(ev) => setF({ ...f, pharmacy: ev.target.value })} />
        {(["medications", "allergies"] as const).map((k) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={`i-${k}`} className="text-base">{k === "medications" ? "Current medicines" : "Allergies"}</Label>
            <Textarea id={`i-${k}`} rows={2} maxLength={500} disabled={f[`${k}_none`]} value={f[k]} aria-invalid={!!e[k]} aria-describedby={e[k] ? `i-${k}-err` : undefined} className="text-base" onChange={(ev) => setF({ ...f, [k]: ev.target.value })} />
            {noneBox(`${k}_none`, `i-${k}-none`)}
            {e[k] && <p id={`i-${k}-err`} className="text-sm text-warning">{e[k]}</p>}
          </div>
        ))}
        <div className="flex items-start gap-3">
          <Checkbox id="i-consent" checked={f.consent} onCheckedChange={(c) => setF({ ...f, consent: c === true })} className="mt-1 h-6 w-6" />
          <Label htmlFor="i-consent" className="text-base leading-snug">This is a demo; I have not entered real health information.</Label>
        </div>
        {e.consent && <p className="text-sm text-warning">{e.consent}</p>}
        <Button type="submit" variant="cta" size="lg" className="w-full sm:w-auto" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Send intake form</Button>
      </form>
    </PageShell>
  );
}
