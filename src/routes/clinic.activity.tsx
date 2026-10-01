import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  BellRing,
  CalendarCheck,
  CalendarX,
  Clock,
  ClipboardList,
  FileText,
  Inbox,
  Info,
  Loader2,
  Mail,
  MessageSquare,
  PhoneOff,
  Play,
  RefreshCw,
  RotateCcw,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getActivity, resetDemo, setDemoClock } from "@/lib/staff.functions";
import { LoadingSkeleton } from "@/components/maya/LoadingSkeleton";
import { EmptyState } from "@/components/maya/EmptyState";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtLongDay, fmtSlot, fmtTime } from "@/lib/tz";

export const Route = createFileRoute("/clinic/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Brightleaf staff" },
      { name: "description", content: "What Maya did and the time it saved." },
      { property: "og:title", content: "Activity — Brightleaf staff" },
      { property: "og:description", content: "What Maya did and the time it saved." },
    ],
  }),
  component: ActivityPage,
});

type ClockAction = "plus_hour" | "plus_day" | "plus_2days" | "tomorrow_7am" | "real_time" | "run_only";
const CLOCK_BUTTONS: { action: ClockAction; label: string; tip: string; icon: LucideIcon }[] = [
  { action: "plus_hour", label: "+1 hour", tip: "Jump ahead one hour. Good for seeing a waitlist offer expire.", icon: Clock },
  { action: "plus_day", label: "+1 day", tip: "Jump ahead one day. Reminders and reconfirm requests go out.", icon: Clock },
  { action: "plus_2days", label: "+2 days", tip: "Jump ahead two days. Unconfirmed visits get released and offered to the waitlist.", icon: Clock },
  { action: "tomorrow_7am", label: "7:00am tomorrow", tip: "Jump to tomorrow at 7am, when same-day sick slots open.", icon: BellRing },
  { action: "real_time", label: "Reset to real time", tip: "Stop simulating and use today's real date and time.", icon: RotateCcw },
];
const RUN_TIP = "Run Maya's checks at the current time without moving the clock.";

const RULE: Record<string, { icon: LucideIcon; label: string }> = {
  self_service_booking: { icon: CalendarCheck, label: "Booking" },
  instant_confirmation: { icon: Mail, label: "Confirmation" },
  intake_chaser: { icon: FileText, label: "Intake reminder" },
  confirm_or_release: { icon: CalendarX, label: "Confirm or release" },
  waitlist_refill: { icon: Users, label: "Waitlist" },
  sick_opening: { icon: Stethoscope, label: "Sick slots" },
  lead_nudge: { icon: MessageSquare, label: "Lead nudge" },
  recall: { icon: RefreshCw, label: "Recall" },
  task_routing: { icon: ClipboardList, label: "Task routing" },
  patient_self_service: { icon: UserCheck, label: "Patient change" },
};
const ruleInfo = (r: string | null) => RULE[r ?? ""] ?? { icon: Activity, label: r ?? "Message" };
const hrs = (m: number) => (m / 60).toFixed(1);

function ActivityPage() {
  const qc = useQueryClient();
  const fetchActivity = useServerFn(getActivity);
  const clock = useServerFn(setDemoClock);
  const reset = useServerFn(resetDemo);
  const q = useQuery({ queryKey: ["activity"], queryFn: () => fetchActivity() });
  const [busy, setBusy] = useState<ClockAction | null>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const run = useMutation({
    mutationFn: (action: ClockAction) => clock({ data: { action } }),
    onMutate: (a) => setBusy(a),
    onSuccess: (r) => toast.success(r.text),
    onError: () => toast.error("Couldn't run that. Please try again."),
    onSettled: () => {
      setBusy(null);
      qc.invalidateQueries();
    },
  });
  const resetM = useMutation({
    mutationFn: () => reset(),
    onSuccess: () => toast.success("Demo data rebuilt. Clock set to Monday 7:30am."),
    onError: () => toast.error("Couldn't reset the demo data."),
    onSettled: () => qc.invalidateQueries(),
  });

  if (q.isLoading) return <LoadingSkeleton rows={6} />;
  if (q.isError || !q.data)
    return (
      <EmptyState icon={Activity} title="Couldn't load activity">
        <Button variant="outline" className="mt-3 min-h-11" onClick={() => q.refetch()}>Try again</Button>
      </EmptyState>
    );
  const d = q.data;
  const msg = d.outbox.find((m) => m.id === openMsg);

  return (
    <div className="space-y-6">
      {/* Demo clock */}
      <section aria-label="Demo clock" className="surface-tile sticky top-2 z-10 rounded-xl border border-border bg-card/95 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div aria-live="polite">
            <p className="text-sm text-muted-foreground">{fmtLongDay(d.now)}</p>
            <p className="text-2xl font-semibold tabular-nums">{fmtTime(d.now)}</p>
          </div>
          {d.simulated ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-sm font-semibold text-warning">
              <Clock className="h-4 w-4" aria-hidden="true" /> Simulated time
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm text-muted-foreground">Real time</span>
          )}
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="mt-3 flex flex-wrap gap-2">
            {CLOCK_BUTTONS.map((b) => (
              <Tooltip key={b.action}>
                <TooltipTrigger asChild>
                  <Button variant="outline" className="min-h-11" disabled={!!busy} onClick={() => run.mutate(b.action)}>
                    {busy === b.action ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <b.icon className="h-4 w-4" aria-hidden="true" />}
                    {b.label}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-center">{b.tip}</TooltipContent>
              </Tooltip>
            ))}
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="cta" className="min-h-11" disabled={!!busy} onClick={() => run.mutate("run_only")}>
                    {busy === "run_only" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    Run automations now
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-56 text-center">{RUN_TIP}</TooltipContent>
              </Tooltip>
              <Popover open={helpOpen} onOpenChange={setHelpOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="How the demo clock works" aria-expanded={helpOpen}>
                    <Info className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 sm:w-96">
                  <h2 className="text-sm font-semibold">How the demo clock works</h2>
                  <p className="mt-2 text-xs">
                    This page shows what Maya does on her own. The clock lets you fast-forward time to watch her follow-ups happen — nothing is actually sent.
                  </p>
                  <ul className="mt-3 space-y-2 text-xs">
                    <li><span className="font-semibold">Run automations now</span> — Maya checks everything due at the current time, without moving the clock: sends intake and reconfirm reminders, releases visits that weren't reconfirmed in time, offers freed slots to the waitlist, nudges people who didn't finish booking, sends recall reminders and replies to refill/records requests. Running it twice never sends anything twice.</li>
                    <li><span className="font-semibold">+1 hour</span> — jump ahead one hour, then run the checks. Good for seeing a waitlist offer expire.</li>
                    <li><span className="font-semibold">+1 day</span> — jump ahead one day, then run the checks. Reminders and reconfirm requests go out.</li>
                    <li><span className="font-semibold">+2 days</span> — jump ahead two days, then run the checks. Unconfirmed visits get released and offered to the waitlist.</li>
                    <li><span className="font-semibold">7:00am tomorrow</span> — jump to tomorrow at 7am, when same-day sick slots open.</li>
                    <li><span className="font-semibold">Reset to real time</span> — stop simulating and use today's real date and time. Your data stays as it is.</li>
                    <li><span className="font-semibold">Reset demo data (bottom of this page)</span> — start the demo over: restores the fictional patients, visits and waitlist, clears the outbox and activity, and sets the clock back to Monday 7:30am. Staff logins are kept.</li>
                  </ul>
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    Tip: press Reset demo data, cancel a visit in Schedule, then press +1 day twice, and watch What Maya did and the Outbox.
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </TooltipProvider>
        {d.simulated && (
          <p className="mt-3 text-sm text-muted-foreground">Simulated time — fast-forward to see Maya's follow-ups. Nothing is really sent.</p>
        )}
      </section>

      {/* Impact */}
      <section aria-labelledby="impact">
        <h1 id="impact" className="text-2xl font-semibold">Impact</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat icon={Clock} value={`${hrs(d.impact.minutes_today)} h`} label="Hours saved today" sub={`${hrs(d.impact.minutes_week)} h last 7 days`} estimate />
          <Stat icon={CalendarCheck} value={d.impact.booked_without_staff} label="Visits booked without staff" sub={`${d.impact.booked_without_staff_week} last 7 days`} />
          <Stat icon={UserCheck} value={d.impact.no_shows_prevented} label="No-shows prevented" sub={`${d.impact.no_shows_prevented_week} last 7 days`} />
          <Stat icon={Users} value={d.impact.refilled} label="Slots refilled from waitlist" sub={`${d.impact.refilled_week} last 7 days`} />
          <Stat icon={PhoneOff} value={d.impact.calls_avoided} label="Calls avoided" sub={`${d.impact.calls_avoided_week} last 7 days`} />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Estimates based on the clinic's time per task (fictional client).</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Feed */}
        <section aria-labelledby="feed">
          <h2 id="feed" className="text-xl font-semibold">What Maya did</h2>
          {d.feed.length === 0 ? (
            <div className="mt-3"><EmptyState icon={Activity} title="Nothing yet">Move the clock forward to see Maya follow up.</EmptyState></div>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.feed.map((r) => {
                const info = ruleInfo(r.rule);
                return (
                  <li key={r.id} className="surface-tile flex gap-3 rounded-xl border border-border p-3">
                    <info.icon className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p>{r.details?.text ?? info.label}</p>
                      <p className="text-sm text-muted-foreground">
                        {info.label} · {fmtSlot(r.run_at)}{r.minutes_saved ? ` · saved ${r.minutes_saved} min` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Outbox */}
        <section aria-labelledby="outbox">
          <h2 id="outbox" className="text-xl font-semibold">Outbox</h2>
          {d.outbox.length === 0 ? (
            <div className="mt-3"><EmptyState icon={Inbox} title="No messages yet" /></div>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.outbox.map((m) => {
                const open = openMsg === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpenMsg(open ? null : m.id)}
                      className="surface-tile flex min-h-11 w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors duration-200 hover:border-surface-hover"
                    >
                      {m.channel === "sms" ? <MessageSquare className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" /> : <Mail className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{m.to_address}</span>
                        <span className="block text-sm text-muted-foreground">
                          {m.channel.toUpperCase()} · {ruleInfo(m.rule).label} · {fmtSlot(m.sent_at)}
                        </span>
                      </span>
                    </button>
                    {open && msg && <Preview m={msg} />}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-dashed border-border p-4">
        <h2 className="font-semibold">Demo data</h2>
        <p className="text-sm text-muted-foreground">Rebuild the fictional demo data and set the clock back to Monday 7:30am. Staff logins are kept.</p>
        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" className="min-h-11" disabled={resetM.isPending} onClick={() => confirm("Rebuild all demo data? Test bookings will be removed.") && resetM.mutate()}>
            {resetM.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
            Reset demo data
          </Button>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" className="min-h-11 min-w-11" aria-label="What resetting demo data does">
                  <Info className="h-5 w-5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-center">
                Starts the demo over: restores fictional data, clears the outbox and activity, sets the clock to Monday 7:30am. Staff logins are kept.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, value, label, sub, estimate }: { icon: LucideIcon; value: string | number; label: string; sub?: string; estimate?: boolean }) {
  return (
    <div className="surface-tile rounded-xl border border-border p-4">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <p className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tabular-nums">
        {value}
        {estimate && <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">fictional estimate</span>}
      </p>
      <p className="text-sm">{label}</p>
      {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

const MAX_URL_DISPLAY = 32;

// Shorten long links for display only — the real token stays in the data.
function trimUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/g, (url) =>
    url.length <= MAX_URL_DISPLAY ? url : `${url.slice(0, MAX_URL_DISPLAY)}…`
  );
}

function Preview({ m }: { m: { channel: string; to_address: string; subject: string | null; body: string } }) {
  if (m.channel === "sms")
    return (
      <div className="mx-auto mt-2 max-w-xs min-w-0 rounded-[2rem] border border-border bg-background p-4">
        <p className="text-center text-sm text-muted-foreground">Brightleaf · to {m.to_address}</p>
        <p className="mt-3 [overflow-wrap:anywhere] whitespace-pre-line rounded-2xl rounded-bl-sm bg-secondary p-3 text-secondary-foreground">{trimUrls(m.body)}</p>
      </div>
    );
  return (
    <div className="mt-2 min-w-0 rounded-xl border border-border bg-background p-4">
      <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">To: {m.to_address}</p>
      <p className="mt-1 font-semibold">{m.subject ?? "(no subject)"}</p>
      <p className="mt-2 [overflow-wrap:anywhere] whitespace-pre-line">{trimUrls(m.body)}</p>
    </div>
  );
}
