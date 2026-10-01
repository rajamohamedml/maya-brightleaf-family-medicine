import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin, Phone, ShieldCheck, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Patient guide - Brightleaf Family Medicine" },
      { name: "description", content: "How booking works at Brightleaf Family Medicine: hours, insurance, what to bring and how to reach Maya, our front desk assistant." },
      { property: "og:title", content: "Patient guide - Brightleaf Family Medicine" },
      { property: "og:description", content: "Hours, insurance, what to bring and how to book a visit with Maya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const sections = [
  {
    icon: CalendarDays,
    title: "Booking a visit",
    body: "Tap Book a visit and answer a few short questions. Maya shows only times that are truly open, and your visit is confirmed the moment you pick one. You can also chat with Maya, who books the same visits.",
    link: { to: "/book", label: "Book a visit" },
  },
  {
    icon: Clock,
    title: "Clinic hours",
    body: "Monday to Thursday 8:00am-5:00pm, Friday 8:00am-3:00pm. Lunch 12:00-1:00pm daily. Wednesday 1:00-5:00pm is telehealth only. Sick visits are seen the same morning, 8:00-9:00am.",
  },
  {
    icon: MapPin,
    title: "Where we are",
    body: "100 Brightleaf Way, Irving, TX 75039 (fictional). There is free parking in front of the clinic.",
  },
  {
    icon: Stethoscope,
    title: "Insurance & costs",
    body: "We accept Aetna, Blue Cross Blue Shield of Texas, UnitedHealthcare, Cigna, Medicare and self-pay. A self-pay new visit is $150 and a follow-up is $95. We're sorry, but we don't accept Medicaid - we can call you back to talk through options.",
  },
  {
    icon: ShieldCheck,
    title: "What to bring",
    body: "Bring a photo ID, your insurance card, a list of your medicines, and any forms you completed. New patients can finish the intake form online before the visit.",
  },
  {
    icon: Phone,
    title: "In an emergency",
    body: "If you have chest pain, trouble breathing, signs of a stroke, heavy bleeding or thoughts of self-harm, call 911 now. For a mental health crisis, call or text 988. Maya can't give medical advice - she routes clinical questions to Dr. Rahman's team.",
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-10 lg:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Patient guide</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Everything you need to know before your visit to Brightleaf Family Medicine.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <s.icon className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <h2 className="text-lg font-semibold">{s.title}</h2>
            </div>
            <p className="mt-2 leading-relaxed text-muted-foreground">{s.body}</p>
            {s.link && (
              <Link
                to={s.link.to}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {s.link.label}
              </Link>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
