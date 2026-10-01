import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
  Building2,
  CalendarCheck,
  Check,
  Clock,
  MapPin,
  ShieldCheck,
  Video,
  X,
} from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { CLINIC, HOURS, INSURERS, VISIT_TYPES } from "@/lib/clinic-info";
import { getPublicImpact } from "@/lib/booking.functions";

const MayaChat = lazy(() =>
  import("@/components/chat/MayaChat").then((m) => ({ default: m.MayaChat })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Book with Dr. Rahman — Brightleaf Family Medicine" },
      {
        name: "description",
        content:
          "Maya books, confirms and reminds, 24/7. Get in with Dr. Rahman — no hold music. Fictional demo clinic.",
      },
      { property: "og:title", content: "Book with Dr. Rahman — Brightleaf Family Medicine" },
      {
        property: "og:description",
        content:
          "Maya books, confirms and reminds, 24/7. Fictional demo clinic in Las Colinas, TX.",
      },
    ],
  }),
  loader: () => getPublicImpact(),
  errorComponent: () => (
    <PageShell>
      <p>Something went wrong. Please refresh.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p>Page not found.</p>
    </PageShell>
  ),
  component: Landing,
});

const BEFORE = [
  "40+ calls between 8 and 9:30am",
  "1 in 3 callers hang up",
  "1 in 5 new patients no-show",
  "45 minutes of evening admin for Dr. Rahman",
];
const AFTER = [
  "Booked in under 2 minutes, any hour",
  "Confirmed instantly",
  "No-shows released and refilled automatically",
  "About 2 minutes of evening review",
];

const btn =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-colors duration-200";
const VISIT_TINTS = [
  "visit-teal",
  "visit-sky",
  "visit-violet",
  "visit-amber",
  "visit-rose",
  "visit-cyan",
];

function Landing() {
  const impact = Route.useLoaderData();
  return (
    <PageShell>
      <div className="hero-glow -mx-4 px-4 py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_540px] lg:items-start lg:gap-10 lg:px-4 lg:py-12">
        <div>
          <p className="text-sm font-semibold text-primary">
            {CLINIC.doctor} · Las Colinas, Irving
          </p>
          <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Get in with Dr. Rahman — no hold music.
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Maya books, confirms and reminds, 24/7.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              <span className="font-semibold">{impact.hours}</span> staff hours saved this week
            </span>
          </p>
          <div className="mt-6">
            <Link to="/book" className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90`}>
              <CalendarCheck className="h-5 w-5" aria-hidden="true" /> Book a visit
            </Link>
          </div>
        </div>
        <div
          aria-label="Chat with Maya"
          className="mt-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-20 lg:mt-0"
        >
          <Suspense fallback={<LoadingSkeleton rows={10} />}>
            <MayaChat embedded />
          </Suspense>
        </div>
        <div className="mt-10 min-w-0 lg:col-start-1 lg:row-start-2 lg:mt-0">

      <section
        aria-labelledby="ba"
        className="surface-tile rounded-xl border border-border p-5 transition-colors duration-200 hover:border-surface-hover sm:p-6"
      >
        <h2 id="ba" className="text-xl font-semibold">
          Before vs. after Maya
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="before-tile rounded-lg border border-border p-4">
            <List title="Before" items={BEFORE} icon={X} iconCls="text-destructive" />
          </div>
          <div className="after-tile rounded-lg border border-border p-4">
            <List title="After" items={AFTER} icon={Check} iconCls="text-success" />
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Hypothetical client figures.</p>
      </section>

      <section aria-labelledby="vt" className="mt-10">
        <h2 id="vt" className="text-xl font-semibold">
          Visit types
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {VISIT_TYPES.map((v, index) => (
            <li
              key={v.code}
              className={`${VISIT_TINTS[index]} rounded-xl border border-border bg-card p-4 transition-colors duration-200 hover:border-surface-hover`}
            >
              <p className="text-[15px] font-semibold">{v.name}</p>
              <p className="text-sm text-muted-foreground">{v.note}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                  {v.minutes} min
                </span>
                {v.modes.map((m) => (
                  <span key={m} className="inline-flex items-center gap-1">
                    {m === "telehealth" ? (
                      <Video className="h-4 w-4 text-primary" aria-hidden="true" />
                    ) : (
                      <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    )}
                    {m === "telehealth" ? "Telehealth" : "In person"}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <div className="surface-tile rounded-xl border border-border p-5 transition-colors duration-200 hover:border-surface-hover">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Insurance we take
          </h2>
          <ul className="mt-3 space-y-1 text-sm">
            {INSURERS.map((i) => (
              <li key={i} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
                {i}
              </li>
            ))}
            <li className="flex items-center gap-2 text-muted-foreground">
              <X className="h-4 w-4" aria-hidden="true" />
              Medicaid — not accepted
            </li>
          </ul>
          <p className="mt-2 text-sm text-muted-foreground">
            Self-pay: new visit $150, follow-up $95.
          </p>
        </div>
        <div className="surface-tile rounded-xl border border-border p-5 transition-colors duration-200 hover:border-surface-hover">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
            Hours
          </h2>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {HOURS.map((h) => (
              <div key={h.days} className="contents">
                <dt className="whitespace-nowrap">{h.days}</dt>
                <dd className="whitespace-nowrap text-right text-muted-foreground">{h.time}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Lunch 12–1 PM.</span> <span className="whitespace-nowrap">Wednesday 1–5 PM: telehealth only.</span>
          </p>
        </div>
        <div className="surface-tile rounded-xl border border-border p-5 transition-colors duration-200 hover:border-surface-hover">
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Find us
          </h2>
          <p className="mt-3 text-sm">{CLINIC.address}</p>
          <p className="mt-1 text-sm text-muted-foreground">{CLINIC.phone}</p>
        </div>
      </section>
        </div>
      </div>
    </PageShell>
  );
}

function List({
  title,
  items,
  icon: Icon,
  iconCls,
}: {
  title: string;
  items: string[];
  icon: typeof Check;
  iconCls: string;
}) {
  return (
    <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <ul className="mt-2 space-y-2 text-sm">
        {items.map((t) => (
          <li key={t} className="flex gap-2">
            <Icon className={`mt-1 h-4 w-4 shrink-0 ${iconCls}`} aria-hidden="true" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
