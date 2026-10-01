import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, CheckCircle2, Clock, Hourglass, ListTodo, Loader2, Phone, UserRoundX } from "lucide-react";
import { getInbox, markTaskDone } from "@/lib/staff.functions";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtSlot } from "@/lib/tz";
import type { ReactNode } from "react";

export const Route = createFileRoute("/clinic/inbox")({
  head: () => ({
    meta: [
      { title: "Inbox — Brightleaf staff" },
      { name: "description", content: "Tasks, waitlist and leads to handle." },
      { property: "og:title", content: "Inbox — Brightleaf staff" },
      { property: "og:description", content: "Tasks, waitlist and leads to handle." },
    ],
  }),
  component: InboxPage,
});

const STEP_LABEL: Record<string, string> = {
  reason: "Picked a reason",
  safety: "Safety check",
  patient: "Patient details",
  insurance: "Insurance",
  contact_details: "Contact details",
  choose_time: "Choosing a time",
  review: "Reviewing booking",
};
const KIND_LABEL: Record<string, string> = { refill: "Refill", records: "Records", billing: "Billing", callback: "Callback" };

function Row({ children }: { children: ReactNode }) {
  return <li className="surface-tile rounded-xl border border-border p-3">{children}</li>;
}

function TaskRow({ t }: { t: any }) {
  const qc = useQueryClient();
  const done = useServerFn(markTaskDone);
  const m = useMutation({
    mutationFn: () => done({ data: { id: t.id } }),
    onSuccess: () => {
      toast.success("Marked done");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: () => toast.error("Couldn't save. Please try again."),
  });
  return (
    <Row>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">
            <span className="mr-2 rounded-full bg-accent px-2 py-0.5 text-sm text-accent-foreground">{KIND_LABEL[t.kind]}</span>
            {t.contact_name}
          </p>
          <p className="mt-1">{t.summary}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.contact_phone && (
              <a href={`tel:${t.contact_phone}`} className="mr-3 inline-flex items-center gap-1 text-primary underline"><Phone className="h-4 w-4" aria-hidden="true" />{t.contact_phone}</a>
            )}
            {fmtSlot(t.created_at)}
          </p>
        </div>
        <Button variant="outline" className="min-h-11" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />} Mark done
        </Button>
      </div>
    </Row>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState icon={CheckCircle2} title={text} />;
}

function InboxPage() {
  const fetchInbox = useServerFn(getInbox);
  const q = useQuery({ queryKey: ["staff", "inbox"], queryFn: () => fetchInbox() });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Inbox</h1>
      {q.isLoading ? (
        <div className="mt-4"><LoadingSkeleton rows={4} /></div>
      ) : q.error || !q.data ? (
        <div className="mt-4">
          <EmptyState icon={AlertTriangle} title="The inbox didn't load">
            <Button variant="outline" className="mt-3 min-h-11" onClick={() => q.refetch()}>Try again</Button>
          </EmptyState>
        </div>
      ) : (
        <InboxTabs d={q.data} />
      )}
    </div>
  );
}

function InboxTabs({ d }: { d: Awaited<ReturnType<typeof getInbox>> }) {
  const needs = d.needs.callbacks.length + d.needs.released.length;
  const tabs = [
    { v: "needs", label: "Needs you", n: needs },
    { v: "tasks", label: "Tasks", n: d.tasks.length },
    { v: "waitlist", label: "Waitlist", n: d.waitlist.length },
    { v: "leads", label: "Leads", n: d.leads.length },
  ];
  return (
    <Tabs defaultValue="needs" className="mt-4">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-4">
        {tabs.map((t) => (
          <TabsTrigger key={t.v} value={t.v} className="min-h-11 gap-2">
            {t.label}
            <span className={t.n ? "rounded-full bg-cta px-1.5 text-sm font-semibold text-cta-foreground" : "text-sm text-muted-foreground"}>{t.n}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="needs" className="mt-4">
        {needs === 0 ? (
          <Empty text="Nothing needs you right now" />
        ) : (
          <ul className="space-y-3">
            {d.needs.callbacks.map((t) => <TaskRow key={t.id} t={t} />)}
            {d.needs.released.map((a) => (
              <Row key={a.id}>
                <p className="flex items-center gap-2 font-semibold text-warning">
                  <UserRoundX className="h-4 w-4" aria-hidden="true" /> Released — not reconfirmed
                </p>
                <p className="mt-1">{a.patients?.first_name} {a.patients?.last_name} · {a.visit_types?.name}</p>
                <p className="text-sm text-muted-foreground">Was {fmtSlot(a.start_at)} · <a className="text-primary underline" href={`tel:${a.patients?.phone}`}>{a.patients?.phone}</a></p>
              </Row>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="tasks" className="mt-4">
        {d.tasks.length === 0 ? <Empty text="No tasks waiting" /> : <ul className="space-y-3">{d.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>}
      </TabsContent>

      <TabsContent value="waitlist" className="mt-4">
        {d.waitlist.length === 0 ? (
          <Empty text="The waitlist is empty" />
        ) : (
          <ol className="space-y-3">
            {d.waitlist.map((w, i) => (
              <Row key={w.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground" aria-label={`Position ${i + 1}`}>{i + 1}</span>
                  <span className="font-semibold">{w.patients?.first_name} {w.patients?.last_name}</span>
                  {w.status === "offered" ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-sm font-semibold text-warning">
                      <Hourglass className="h-4 w-4" aria-hidden="true" /> Offered{w.offer_expires_at ? ` · expires ${fmtSlot(w.offer_expires_at)}` : ""}
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-sm font-semibold text-muted-foreground">
                      <Clock className="h-4 w-4" aria-hidden="true" /> Waiting
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {w.visit_type_codes.map((c: string) => c.replace("_", " ")).join(" or ")} · {w.earliest_date} to {w.latest_date} · {w.window === "am" ? "Mornings" : w.window === "pm" ? "Afternoons" : "Any time"}
                </p>
              </Row>
            ))}
          </ol>
        )}
      </TabsContent>

      <TabsContent value="leads" className="mt-4">
        {d.leads.length === 0 ? (
          <Empty text="No unfinished bookings" />
        ) : (
          <ul className="space-y-3">
            {d.leads.map((l) => (
              <Row key={l.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <ListTodo className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span className="font-semibold">{[l.first_name, l.last_name].filter(Boolean).join(" ") || "Unknown visitor"}</span>
                  <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-sm text-accent-foreground">Stopped at: {STEP_LABEL[l.step_reached] ?? l.step_reached}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {l.phone && <a className="mr-3 text-primary underline" href={`tel:${l.phone}`}>{l.phone}</a>}
                  via {l.source} · last active {fmtSlot(l.last_activity_at)}{l.nudged_at ? " · nudged" : ""}
                </p>
              </Row>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
