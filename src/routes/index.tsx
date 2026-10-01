import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, CalendarCheck, Check, Clock, MapPin, MessageCircle, Mic, ShieldCheck, Video, X } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { CLINIC, HOURS, INSURERS, VISIT_TYPES } from "@/lib/clinic-info";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book with Dr. Rahman — Brightleaf Family Medicine" },
      { name: "description", content: "Maya books, confirms and reminds, 24/7. Get in with Dr. Rahman — no hold music. Fictional demo clinic." },
      { property: "og:title", content: "Book with Dr. Rahman — Brightleaf Family Medicine" },
      { property: "og:description", content: "Maya books, confirms and reminds, 24/7. Fictional demo clinic in Las Colinas, TX." },
    ],
  }),
  component: Landing,
});

const BEFORE = ["40+ calls between 8 and 9:30am", "1 in 3 callers hang up", "1 in 5 new patients no-show", "45 minutes of evening admin for Dr. Rahman"];
const AFTER = ["Booked in under 2 minutes, any hour", "Confirmed instantly", "No-shows released and refilled automatically", "About 2 minutes of evening review"];

const btn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-colors";

function Landing() {
  return (
    <PageShell>
      <section className="py-6 sm:py-12">
        <p className="text-sm font-semibold text-primary">{CLINIC.doctor} · Las Colinas, Irving</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">Get in with Dr. Rahman — no hold music.</h1>
        <p className="mt-3 text-lg text-muted-foreground">Maya books, confirms and reminds, 24/7.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/book" className={`${btn} bg-cta text-cta-foreground hover:bg-cta/90`}>
            <CalendarCheck className="h-5 w-5" aria-hidden="true" /> Book a visit
          </Link>
          <Link to="/chat" className={`${btn} border border-input bg-card hover:bg-accent`}>
            <MessageCircle className="h-5 w-5" aria-hidden="true" /> Chat with Maya
          </Link>
          <Link to="/chat" search={{ voice: 1 }} className={`${btn} text-primary hover:bg-accent`}>
            <Mic className="h-5 w-5" aria-hidden="true" /> Talk to Maya
          </Link>
        </div>
      </section>

      <section aria-labelledby="ba" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <h2 id="ba" className="text-xl font-semibold">Before vs. after Maya</h2>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          <List title="Before" items={BEFORE} icon={X} iconCls="text-muted-foreground" />
          <List title="After" items={AFTER} icon={Check} iconCls="text-success" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Hypothetical client figures.</p>
      </section>

      <section aria-labelledby="vt" className="mt-10">
        <h2 id="vt" className="text-xl font-semibold">Visit types</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VISIT_TYPES.map((v) => (
            <li key={v.code} className="rounded-xl border border-border bg-card p-4">
              <p className="font-semibold">{v.name}</p>
              <p className="text-sm text-muted-foreground">{v.note}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4 text-primary" aria-hidden="true" />{v.minutes} min</span>
                {v.modes.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1">
                    {m === "telehealth" ? <Video className="h-4 w-4 text-primary" aria-hidden="true" /> : <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />}
                    {m === "telehealth" ? "Telehealth" : "In person"}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />Insurance we take</h2>
          <ul className="mt-3 space-y-1">
            {INSURERS.map((i) => <li key={i} className="flex items-center gap-2"><Check className="h-4 w-4 text-success" aria-hidden="true" />{i}</li>)}
            <li className="flex items-center gap-2 text-muted-foreground"><X className="h-4 w-4" aria-hidden="true" />Medicaid — not accepted</li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">Self-pay: new visit $150, follow-up $95.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Clock className="h-5 w-5 text-primary" aria-hidden="true" />Hours</h2>
          <dl className="mt-3 space-y-1">
            {HOURS.map((h) => <div key={h.days} className="flex justify-between gap-2"><dt>{h.days}</dt><dd className="text-muted-foreground">{h.time}</dd></div>)}
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">Lunch 12–1 PM. Wednesday afternoons are telehealth only.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold"><MapPin className="h-5 w-5 text-primary" aria-hidden="true" />Find us</h2>
          <p className="mt-3">{CLINIC.address} (fictional)</p>
          <p className="mt-1 text-muted-foreground">{CLINIC.phone}</p>
        </div>
      </section>
    </PageShell>
  );
}

function List({ title, items, icon: Icon, iconCls }: { title: string; items: string[]; icon: typeof Check; iconCls: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-2 space-y-2">
        {items.map((t) => (
          <li key={t} className="flex gap-2"><Icon className={`mt-1 h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />{t}</li>
        ))}
      </ul>
    </div>
  );
}
