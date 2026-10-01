// Staff-only server functions. Every call requires a signed-in user with the 'staff' role;
// queries run as that user, so row-level security is the second guard.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addDays, isoDow, localDateStr, localMinutes, zonedToUtc } from "./tz";
import { getRequest } from "@tanstack/react-start/server";
import { runAutomations, summaryText } from "./automations.server";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
const BLOCKING: ("confirmed" | "reconfirmed" | "arrived")[] = ["confirmed", "reconfirmed", "arrived"];
const DOW_KEY = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type Ctx = { supabase: any; userId: string };

async function assertStaff(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "staff" });
  if (!data) throw new Error("Forbidden: staff only");
}

const toMin = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

async function clinicNow(sb: any) {
  const { data } = await sb.from("clinic_settings").select("demo_now,hours").eq("id", 1).maybeSingle();
  return { now: data?.demo_now ? new Date(data.demo_now) : new Date(), hours: (data?.hours ?? {}) as Record<string, [string, string]> };
}

type Range = { start: number; end: number };
/** Free 15-minute steps on a day (after `fromMin`), ignoring lunch/blocked time and booked visits (+5 min buffer). */
function freeTime(date: string, hours: Record<string, [string, string]>, appts: { start_at: string; end_at: string }[], blocks: { kind: string; start_at: string; end_at: string }[], fromMin = 0) {
  const h = hours[DOW_KEY[isoDow(date)] ?? ""];
  if (!h) return { steps: 0, gaps: [] as Range[] };
  const [open, close] = [toMin(h[0]), toMin(h[1])];
  const busy: Range[] = [
    ...appts.map((a) => ({ start: localMinutes(new Date(a.start_at)), end: localMinutes(new Date(a.end_at)) + 5 })),
    ...blocks.filter((b) => b.kind === "lunch" || b.kind === "blocked").map((b) => ({ start: localMinutes(new Date(b.start_at)), end: localMinutes(new Date(b.end_at)) })),
  ];
  let steps = 0;
  const gaps: Range[] = [];
  for (let m = open; m + 15 <= close; m += 15) {
    if (m < fromMin) continue;
    if (busy.some((b) => m < b.end && m + 15 > b.start)) continue;
    steps++;
    const g = gaps.at(-1);
    if (g && g.end === m) g.end = m + 15;
    else gaps.push({ start: m, end: m + 15 });
  }
  return { steps, gaps };
}

async function dayData(sb: any, date: string) {
  const from = zonedToUtc(date, 0).toISOString();
  const to = zonedToUtc(addDays(date, 1), 0).toISOString();
  const [a, b] = await Promise.all([
    sb
      .from("appointments")
      .select("id,start_at,end_at,mode,status,intake_status,reconfirmed_at,source,manage_token,visit_types(code,name,minutes),patients(id,first_name,last_name,dob,phone,email,insurer,is_new,no_show_count)")
      .gte("start_at", from)
      .lt("start_at", to)
      .order("start_at"),
    sb.from("schedule_blocks").select("id,kind,start_at,end_at,note").gte("start_at", from).lt("start_at", to).order("start_at"),
  ]);
  if (a.error) throw a.error;
  if (b.error) throw b.error;
  return { appts: a.data as any[], blocks: b.data as any[] };
}

export const getToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { now, hours } = await clinicNow(sb);
    const today = localDateStr(now);
    let tomorrow = addDays(today, 1);
    while (isoDow(tomorrow) > 5) tomorrow = addDays(tomorrow, 1);
    const [t, n, tasks] = await Promise.all([
      dayData(sb, today),
      dayData(sb, tomorrow),
      sb.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    const live = t.appts.filter((a) => a.status !== "cancelled" && a.status !== "released");
    const pct = (k: number) => (live.length ? Math.round((k / live.length) * 100) : 0);
    const free = freeTime(today, hours, t.appts.filter((a) => BLOCKING.includes(a.status)), t.blocks, localMinutes(now));
    const tLive = n.appts.filter((a) => BLOCKING.includes(a.status));
    const tFree = freeTime(tomorrow, hours, tLive, n.blocks);
    return {
      date: today,
      summary: {
        visits: live.length,
        reconfirmed_pct: pct(live.filter((a) => a.status !== "confirmed").length),
        intake_pct: pct(live.filter((a) => a.intake_status === "done").length),
        open_slots: free.steps,
        tasks_waiting: tasks.count ?? 0,
      },
      visits: t.appts,
      tomorrow: {
        date: tomorrow,
        visits: tLive.length,
        reconfirmed: tLive.filter((a) => a.status === "reconfirmed").length,
        intake_done: tLive.filter((a) => a.intake_status === "done").length,
        gaps: tFree.gaps.filter((g) => g.end - g.start >= 30),
      },
    };
  });

export const setVisitStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid, status: z.enum(["arrived", "completed", "no_show", "cancelled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { data: a, error } = await sb.from("appointments").update({ status: data.status }).eq("id", data.id).select("patient_id").single();
    if (error) throw error;
    if (data.status === "no_show") {
      const { data: p } = await sb.from("patients").select("no_show_count").eq("id", a.patient_id).single();
      await sb.from("patients").update({ no_show_count: (p?.no_show_count ?? 0) + 1 }).eq("id", a.patient_id);
    }
    return { ok: true };
  });

export const bookRecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ appointment_id: uuid, months: z.union([z.literal(3), z.literal(6), z.literal(12)]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { data: a, error } = await sb.from("appointments").select("patient_id,visit_type_id,start_at").eq("id", data.appointment_id).single();
    if (error) throw error;
    const d = new Date(a.start_at);
    d.setMonth(d.getMonth() + data.months);
    const { error: e2 } = await sb.from("recalls").insert({ patient_id: a.patient_id, visit_type_id: a.visit_type_id, due_date: localDateStr(d) });
    if (e2) throw e2;
    return { ok: true, due_date: localDateStr(d) };
  });

export const getWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ monday: dateStr.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { now } = await clinicNow(sb);
    let monday = data.monday;
    if (!monday) {
      const today = localDateStr(now);
      const dow = isoDow(today);
      monday = dow > 5 ? addDays(today, 8 - dow) : addDays(today, 1 - dow);
    }
    const from = zonedToUtc(monday, 0).toISOString();
    const to = zonedToUtc(addDays(monday, 5), 0).toISOString();
    const [a, b] = await Promise.all([
      sb
        .from("appointments")
        .select("id,start_at,end_at,mode,status,intake_status,visit_types(code,name),patients(first_name,last_name,phone,insurer,is_new)")
        .gte("start_at", from)
        .lt("start_at", to)
        .in("status", [...BLOCKING, "completed" as const, "no_show" as const])
        .order("start_at"),
      sb.from("schedule_blocks").select("id,kind,start_at,end_at,note").gte("start_at", from).lt("start_at", to),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;
    return { monday, today: localDateStr(now), appts: a.data as any[], blocks: b.data as any[] };
  });

export const addBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ date: dateStr, start: z.number().int().min(0).max(1440), end: z.number().int().min(0).max(1440), note: z.string().trim().max(120).optional() })
      .refine((v) => v.end > v.start, "End must be after start")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("schedule_blocks").insert({
      kind: "blocked",
      start_at: zonedToUtc(data.date, data.start).toISOString(),
      end_at: zonedToUtc(data.date, data.end).toISOString(),
      note: data.note || "Blocked",
    });
    if (error) throw error;
    return { ok: true };
  });

export const listPatients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().trim().max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const q = data.q.replace(/[%,()]/g, "");
    let query = context.supabase.from("patients").select("id,first_name,last_name,dob,phone,insurer,is_new").order("last_name").limit(8);
    if (q) query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data: rows, error } = await query;
    if (error) throw error;
    return rows;
  });

export const getInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { now } = await clinicNow(sb);
    const [tasks, released, waitlist, leads] = await Promise.all([
      sb.from("tasks").select("id,kind,status,summary,contact_name,contact_phone,created_at").eq("status", "open").order("created_at"),
      sb
        .from("appointments")
        .select("id,start_at,status,visit_types(name),patients(first_name,last_name,phone)")
        .eq("status", "released")
        .gte("start_at", now.toISOString())
        .order("start_at"),
      sb.from("waitlist").select("id,visit_type_codes,earliest_date,latest_date,window,status,offer_expires_at,offered_start_at,created_at,patients(first_name,last_name,phone)").in("status", ["waiting", "offered"]).order("created_at"),
      sb.from("leads").select("id,first_name,last_name,phone,email,reason_category,source,step_reached,last_activity_at,nudged_at").is("converted_appointment_id", null).order("last_activity_at", { ascending: false }),
    ]);
    for (const r of [tasks, released, waitlist, leads]) if (r.error) throw r.error;
    const all = tasks.data as any[];
    return {
      needs: { callbacks: all.filter((t) => t.kind === "callback"), released: released.data as any[] },
      tasks: all.filter((t) => t.kind !== "callback"),
      waitlist: waitlist.data as any[],
      leads: leads.data as any[],
    };
  });

export const markTaskDone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { error } = await context.supabase.from("tasks").update({ status: "done", done_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getNavCounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { count } = await context.supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "open");
    return { inbox: count ?? 0 };
  });

/* ---------------- Activity: demo clock, impact, feed, outbox ---------------- */
function requestOrigin() {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

export const getActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { data: settings } = await sb.from("clinic_settings").select("demo_now").eq("id", 1).maybeSingle();
    const simulated = !!settings?.demo_now;
    const now = simulated ? new Date(settings!.demo_now as string) : new Date();
    const dayStart = zonedToUtc(localDateStr(now), 0).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const [runs, feed, outbox] = await Promise.all([
      sb.from("automation_runs").select("rule,minutes_saved,run_at,details").lte("run_at", now.toISOString()),
      sb.from("automation_runs").select("id,rule,run_at,details,minutes_saved").order("run_at", { ascending: false }).limit(40),
      sb.from("messages").select("id,channel,template,to_address,subject,body,rule,sent_at").order("sent_at", { ascending: false }).limit(50),
    ]);
    for (const r of [runs, feed, outbox]) if (r.error) throw r.error;
    const all = runs.data as { rule: string; minutes_saved: number; run_at: string; details: any }[];
    const sum = (from: string) => all.filter((r) => r.run_at >= from).reduce((t, r) => t + r.minutes_saved, 0);
    const n = (f: (r: (typeof all)[number]) => boolean) => all.filter(f).length;
    const booked = n((r) => r.rule === "self_service_booking");
    const refilled = n((r) => r.rule === "waitlist_refill" && r.details?.action === "accepted");
    const released = n((r) => r.rule === "confirm_or_release" && r.details?.action === "released");
    const tasks = n((r) => r.rule === "task_routing");
    return {
      now: now.toISOString(),
      simulated,
      impact: {
        minutes_today: sum(dayStart),
        minutes_week: sum(weekAgo),
        booked_without_staff: booked + refilled,
        no_shows_prevented: released + refilled,
        released,
        refilled,
        calls_avoided: booked + refilled + tasks,
      },
      feed: feed.data as any[],
      outbox: outbox.data as any[],
    };
  });

export const setDemoClock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ action: z.enum(["plus_hour", "plus_day", "plus_2days", "tomorrow_7am", "real_time", "run_only"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const sb = context.supabase;
    const { data: s } = await sb.from("clinic_settings").select("demo_now").eq("id", 1).maybeSingle();
    const cur = s?.demo_now ? new Date(s.demo_now) : new Date();
    let next: Date | null = cur;
    const H = 3600_000;
    if (data.action === "plus_hour") next = new Date(cur.getTime() + H);
    if (data.action === "plus_day") next = new Date(cur.getTime() + 24 * H);
    if (data.action === "plus_2days") next = new Date(cur.getTime() + 48 * H);
    if (data.action === "tomorrow_7am") next = zonedToUtc(addDays(localDateStr(cur), 1), 7 * 60);
    if (data.action === "real_time") next = null;
    if (data.action !== "run_only") {
      const { error } = await sb.from("clinic_settings").update({ demo_now: next ? next.toISOString() : null }).eq("id", 1);
      if (error) throw error;
    }
    const summary = await runAutomations(next ?? new Date(), requestOrigin());
    return { summary, text: summaryText(summary) };
  });

export const resetDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("seed_demo");
    if (error) throw error;
    return { ok: true };
  });
