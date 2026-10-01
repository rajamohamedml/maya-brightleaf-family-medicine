import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Clock, Hourglass, Loader2, Sparkles } from "lucide-react";
import { PageShell } from "@/components/maya/PageShell";
import { EmptyState } from "@/components/maya/EmptyState";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { getOffer, respondOffer } from "@/lib/booking.functions";
import { fmtSlot, fmtTime } from "@/lib/tz";

export const Route = createFileRoute("/visit/offer/$id")({
  head: () => ({
    meta: [
      { title: "A spot opened up — Brightleaf Family Medicine" },
      { name: "description", content: "A visit time opened up for you on the waitlist." },
      { property: "og:title", content: "A spot opened up — Brightleaf Family Medicine" },
      { property: "og:description", content: "A visit time opened up for you on the waitlist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OfferPage,
});

function OfferPage() {
  const { id } = Route.useParams();
  const fetchOffer = useServerFn(getOffer);
  const respond = useServerFn(respondOffer);
  const q = useQuery({ queryKey: ["offer", id], queryFn: () => fetchOffer({ data: { id } }) });
  const [busy, setBusy] = useState<"yes" | "no" | null>(null);
  const [done, setDone] = useState<{ token: string | null } | null>(null);

  async function answer(accept: boolean) {
    setBusy(accept ? "yes" : "no");
    try {
      const r = await respond({ data: { id, accept } });
      if ("error" in r) {
        toast.error(r.message);
        q.refetch();
      } else {
        setDone({ token: r.token });
        toast.success(accept ? "You're booked!" : "No problem — we'll offer it to someone else.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell title="A spot opened up">
      <div className="mx-auto max-w-lg" aria-live="polite">
        {q.isLoading ? (
          <LoadingSkeleton rows={3} />
        ) : !q.data || "error" in q.data ? (
          <EmptyState icon={Sparkles} title="We couldn't find this offer">Please check your link, or book a new time.</EmptyState>
        ) : done ? (
          done.token ? (
            <EmptyState icon={CalendarCheck} title={`You're booked, ${q.data.offer.first_name}!`}>
              <p>{q.data.offer.visit_name} on {fmtSlot(q.data.offer.start_at)}. We sent your confirmation.</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/visit/$token" params={{ token: done.token }} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-cta px-5 font-semibold text-cta-foreground">Manage my visit</Link>
                <Link to="/intake/$token" params={{ token: done.token }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-input px-5 font-semibold">Complete intake</Link>
              </div>
            </EmptyState>
          ) : (
            <EmptyState icon={Sparkles} title="Thanks for letting us know">You're off this offer. You can book another time any day.</EmptyState>
          )
        ) : q.data.offer.state !== "open" ? (
          <EmptyState icon={Hourglass} title={q.data.offer.state === "accepted" ? "You already took this spot" : "This offer has ended"}>
            <Link to="/book" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-input px-5 font-semibold">Book another time</Link>
          </EmptyState>
        ) : (
          <div className="surface-tile rounded-xl border border-border p-5">
            <p className="text-muted-foreground">Hi {q.data.offer.first_name}, good news from the waitlist:</p>
            <h2 className="mt-2 text-2xl font-semibold">{q.data.offer.visit_name}</h2>
            <p className="mt-1 text-lg">{fmtSlot(q.data.offer.start_at)}</p>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" aria-hidden="true" /> {q.data.offer.minutes} min · held for you until {q.data.offer.expires_at ? fmtTime(q.data.offer.expires_at) : "soon"}
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button variant="cta" className="min-h-12 flex-1" disabled={!!busy} onClick={() => answer(true)}>
                {busy === "yes" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Accept this time
              </Button>
              <Button variant="ghost" className="min-h-12" disabled={!!busy} onClick={() => answer(false)}>
                {busy === "no" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} No thanks
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
