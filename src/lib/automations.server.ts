// Follow-through engine (Knowledge AUTOMATIONS rules 2-8). Idempotent: every send first checks
// the outbox for the same rule + record, so running it twice never double-messages anyone.
import { computeSlots, db, findSlot, loadVisitType, type VisitTypeRow } from "./scheduling.server";
import { visitCodeForReason } from "./booking-rules";
import { addDays, fmtSlot, fmtTime, isoDow, localDateStr, localMinutes } from "./tz";

export const MINUTES = {
  self_service_booking: 6,
  instant_confirmation: 2,
  intake_chaser: 3,
  confirm_or_release: 3,
  waitlist_refill: 10,
  lead_nudge: 4,
  recall: 5,
  task_routing: 4,
  sick_opening: 4,
} as const;

const H = 3600_000;
export type RunSummary = { reminders: number; released: number; offers: number; expired: number; nudges: number; recalls: number; sick_alerts: number; task_replies: number };
const empty = (): RunSummary => ({ reminders: 0, released: 0, offers: 0, expired: 0, nudges: 0, recalls: 0, sick_alerts: 0, task_replies: 0 });

type Msg = {
  patient_id?: string | null;
  appointment_id?: string | null;
  lead_id?: string | null;
  channel: "sms" | "email";
  template: string;
  to_address: string;
  subject?: string | undefined;
  body: string;
  rule: string;
};

export async function sendMessage(m: Msg, now: Date) {
  await db().from("messages").insert({ ...m, sent_at: now.toISOString() });
}

export async function logRun(rule: string, minutes: number, now: Date, details: Record<string, unknown>) {
  await db().from("automation_runs").insert({ rule, actions_count: 1, minutes_saved: minutes, run_at: now.toISOString(), details: details as never });
}

async function alreadySent(template: string, key: { appointment_id?: string; lead_id?: string }) {
  let q = db().from("messages").select("id", { count: "exact", head: true }).eq("template", template);
  if (key.appointment_id) q = q.eq("appointment_id", key.appointment_id);
  if (key.lead_id) q = q.eq("lead_id", key.lead_id);
  const { count } = await q;
  return (count ?? 0) > 0;
}

const shortName = (code: string) =>
  ({ new_patient: "new-patient", physical: "physical", medicare_awv: "wellness", follow_up: "follow-up", sick: "sick", telehealth: "telehealth" })[code] ?? "";
const time = (iso: string) => fmtTime(iso).replace(" AM", "am").replace(" PM", "pm");

/* ---------------- waitlist refill ---------------- */

/** Offer a freed time to the first matching waiting entry. Returns the offered patient's name, if any. */
export async function refillSlot(startAt: string, now: Date, base: string): Promise<string | null> {
  if (Date.parse(startAt) <= now.getTime()) return null;
  const date = localDateStr(new Date(startAt));
  const min = localMinutes(new Date(startAt));
  // Skip if this time is already on offer to someone.
  const { count: open } = await db().from("waitlist").select("id", { count: "exact", head: true }).eq("status", "offered").eq("offered_start_at", startAt);
  if (open) return null;
  const { data: entries } = await db()
    .from("waitlist")
    .select("id,visit_type_codes,earliest_date,latest_date,window,patients(id,first_name,last_name,phone,is_new,insurer)")
    .eq("status", "waiting")
    .lte("earliest_date", date)
    .gte("latest_date", date)
    .order("created_at");
  for (const w of entries ?? []) {
    if (w.window === "am" && min >= 12 * 60) continue;
    if (w.window === "pm" && min < 13 * 60) continue;
    const p = w.patients;
    if (!p) continue;
    for (const code of w.visit_type_codes) {
      const vt = await loadVisitType(code);
      if (!vt) continue;
      if ((vt.new_only && !p.is_new) || (vt.established_only && p.is_new) || (vt.insurer_only && vt.insurer_only !== p.insurer)) continue;
      const mode = vt.modes.includes("in_person") ? "in_person" : "telehealth";
      const slot = await findSlot({ vt, mode, startAt, now });
      if (!slot) continue;
      const expires = new Date(now.getTime() + 30 * 60_000).toISOString();
      await db().from("waitlist").update({ status: "offered", offered_start_at: startAt, offer_expires_at: expires, offered_visit_code: code }).eq("id", w.id);
      await sendMessage(
        {
          patient_id: p.id,
          channel: "sms",
          template: "waitlist_offer",
          to_address: p.phone,
          body: `Hi ${p.first_name}, a ${vt.name} opened up on ${fmtSlot(startAt)}. It's yours if you want it — tap within 30 minutes: ${base}/visit/offer/${w.id}`,
          rule: "waitlist_refill",
        },
        now,
      );
      return `${p.first_name} ${p.last_name}`;
    }
  }
  return null;
}

async function expireOffers(now: Date, base: string, s: RunSummary) {
  const { data } = await db()
    .from("waitlist")
    .select("id,offered_start_at,patients(first_name,last_name)")
    .eq("status", "offered")
    .lte("offer_expires_at", now.toISOString());
  for (const w of data ?? []) {
    await db().from("waitlist").update({ status: "expired" }).eq("id", w.id);
    s.expired++;
    if (!w.offered_start_at) continue;
    const next = await refillSlot(w.offered_start_at, now, base);
    const who = `${w.patients?.first_name ?? ""} ${w.patients?.last_name ?? ""}`.trim();
    if (next) s.offers++;
    await logRun("waitlist_refill", 0, now, {
      action: "offer_expired",
      text: `${who}'s offer for ${fmtSlot(w.offered_start_at)} expired${next ? ` — offered it to ${next} next.` : ". Nobody else on the waitlist matched."}`,
    });
  }
}

/* ---------------- appointment rules ---------------- */

async function appointmentRules(now: Date, base: string, s: RunSummary) {
  const { data } = await db()
    .from("appointments")
    .select("id,start_at,status,intake_status,created_at,manage_token,patient_id,visit_types(code,name),patients(first_name,last_name,phone,no_show_count)")
    .in("status", ["confirmed", "reconfirmed"])
    .gt("start_at", now.toISOString())
    .lte("start_at", new Date(now.getTime() + 48 * H).toISOString())
    .order("start_at");
  // Patients with a past no-show must reconfirm within 12h of booking, wherever the visit sits.
  const { data: risky } = await db()
    .from("appointments")
    .select("id,start_at,status,intake_status,created_at,manage_token,patient_id,visit_types(code,name),patients!inner(first_name,last_name,phone,no_show_count)")
    .eq("status", "confirmed")
    .gt("start_at", now.toISOString())
    .gte("patients.no_show_count", 1);
  const seen = new Set<string>();
  for (const a of [...(data ?? []), ...(risky ?? [])]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    const p = a.patients;
    if (!p) continue;
    const hrs = (Date.parse(a.start_at) - now.getTime()) / H;
    const vname = a.visit_types?.name ?? "visit";
    const when = fmtSlot(a.start_at);
    const manage = `${base}/visit/${a.manage_token}`;
    const strict = (p.no_show_count ?? 0) >= 1;
    const deadline = strict ? Date.parse(a.created_at) + 12 * H : Date.parse(a.start_at) - 18 * H;

    // Rule 3: confirm-or-release
    if (a.status === "confirmed") {
      if (now.getTime() >= deadline) {
        await db().from("appointments").update({ status: "released" }).eq("id", a.id).eq("status", "confirmed");
        await sendMessage(
          { patient_id: a.patient_id, appointment_id: a.id, channel: "sms", template: "reconfirm_released", to_address: p.phone, body: `Hi ${p.first_name}, we didn't hear back, so we released your ${vname} on ${when}. Tap to rebook any time: ${base}/book`, rule: "confirm_or_release" },
          now,
        );
        s.released++;
        const offered = await refillSlot(a.start_at, now, base);
        if (offered) s.offers++;
        const label = `${p.first_name} ${p.last_name}'s ${time(a.start_at)} ${shortName(a.visit_types?.code ?? "")} visit`.replace("  ", " ");
        await logRun("confirm_or_release", MINUTES.confirm_or_release, now, {
          action: "released",
          appointment_id: a.id,
          offered_to: offered,
          text: `Released ${label} (not reconfirmed)${offered ? ` and offered it to ${offered} from the waitlist.` : ". No waitlist match yet."}`,
        });
        continue;
      }
      if ((hrs <= 48 || strict) && !(await alreadySent("reconfirm_request", { appointment_id: a.id }))) {
        const by = new Date(deadline);
        await sendMessage(
          { patient_id: a.patient_id, appointment_id: a.id, channel: "sms", template: "reconfirm_request", to_address: p.phone, body: `Hi ${p.first_name}, are you still coming to your ${vname} on ${when}? Tap "I'll be there" by ${fmtSlot(by.toISOString())} to keep it: ${manage}`, rule: "confirm_or_release" },
          now,
        );
        s.reminders++;
        await logRun("confirm_or_release", MINUTES.confirm_or_release, now, { action: "request", appointment_id: a.id, text: `Asked ${p.first_name} ${p.last_name} to reconfirm their ${when} ${vname}.` });
      }
    }

    // Rule 2: intake chaser at 48h and 24h
    if (a.intake_status === "not_started" && hrs <= 48) {
      const tpl = hrs <= 24 ? "intake_chaser_24h" : "intake_chaser_48h";
      if (!(await alreadySent(tpl, { appointment_id: a.id }))) {
        await sendMessage(
          { patient_id: a.patient_id, appointment_id: a.id, channel: "sms", template: tpl, to_address: p.phone, body: `Hi ${p.first_name}, your ${vname} is ${hrs <= 24 ? "tomorrow" : "in 2 days"} (${when}). Please fill in your intake form — it takes 3 minutes: ${base}/intake/${a.manage_token}`, rule: "intake_chaser" },
          now,
        );
        s.reminders++;
        await logRun("intake_chaser", MINUTES.intake_chaser, now, { appointment_id: a.id, text: `Reminded ${p.first_name} ${p.last_name} to finish intake before their ${when} ${vname} (${hrs <= 24 ? "24h" : "48h"} reminder).` });
      }
    }
  }
}

/* ---------------- leads, recalls, sick, tasks ---------------- */

async function threeSlots(vt: VisitTypeRow, now: Date) {
  const mode = vt.modes.includes("in_person") ? "in_person" : "telehealth";
  const slots = await computeSlots({ vt, mode, fromDate: localDateStr(now), days: 14, window: "any", now });
  return slots.slice(0, 3).map((x) => fmtSlot(x.start_at));
}

async function sickOpening(now: Date, base: string, s: RunSummary) {
  const today = localDateStr(now);
  if (isoDow(today) > 5 || localMinutes(now) < 7 * 60) return;
  const vt = await loadVisitType("sick");
  if (!vt) return;
  const slots = await computeSlots({ vt, mode: "in_person", fromDate: today, days: 1, window: "any", now });
  if (!slots.length) return;
  const { data: leads } = await db()
    .from("leads")
    .select("id,first_name,last_name,phone,email")
    .eq("reason_category", "sick")
    .is("converted_appointment_id", null)
    .gte("last_activity_at", new Date(now.getTime() - 12 * H).toISOString());
  const tpl = `sick_open_${today}`;
  for (const l of leads ?? []) {
    const to = l.phone || l.email;
    if (!to || (await alreadySent(tpl, { lead_id: l.id }))) continue;
    await sendMessage(
      { lead_id: l.id, channel: l.phone ? "sms" : "email", template: tpl, to_address: to, body: `Hi ${l.first_name ?? "there"}, same-day sick visits just opened (first at ${fmtTime(slots[0]!.start_at)}). Grab one: ${base}/book`, rule: "sick_opening" },
      now,
    );
    s.sick_alerts++;
    await logRun("sick_opening", MINUTES.sick_opening, now, { lead_id: l.id, text: `Told ${l.first_name ?? "a visitor"} ${l.last_name ?? ""} that today's sick slots are open.`.replace("  ", " ") });
  }
}

async function leadNudges(now: Date, base: string, s: RunSummary) {
  const { data: leads } = await db()
    .from("leads")
    .select("id,first_name,last_name,phone,email,reason_category")
    .is("converted_appointment_id", null)
    .is("nudged_at", null)
    .lte("last_activity_at", new Date(now.getTime() - 2 * H).toISOString());
  for (const l of leads ?? []) {
    const to = l.phone || l.email;
    if (!to || !l.reason_category || l.reason_category === "other") continue;
    if (await alreadySent("lead_nudge", { lead_id: l.id })) continue;
    const vt = await loadVisitType(visitCodeForReason(l.reason_category as never, null));
    if (!vt) continue;
    const slots = await threeSlots(vt, now);
    if (!slots.length) continue;
    await sendMessage(
      { lead_id: l.id, channel: l.phone ? "sms" : "email", template: "lead_nudge", to_address: to, subject: l.phone ? undefined : "Still want a visit with Dr. Rahman?", body: `Hi ${l.first_name ?? "there"}, still want a ${vt.name.toLowerCase()}? Open times: ${slots.join("; ")}. Book in 2 minutes: ${base}/book`, rule: "lead_nudge" },
      now,
    );
    await db().from("leads").update({ nudged_at: now.toISOString() }).eq("id", l.id);
    s.nudges++;
    await logRun("lead_nudge", MINUTES.lead_nudge, now, { lead_id: l.id, text: `Nudged ${l.first_name ?? "a visitor"} ${l.last_name ?? ""} who stopped booking, with 3 open times.`.replace("  ", " ") });
  }
}

async function recalls(now: Date, base: string, s: RunSummary) {
  const limit = addDays(localDateStr(now), 7);
  const { data } = await db()
    .from("recalls")
    .select("id,due_date,visit_type_id,visit_types(code,name),patients(id,first_name,last_name,phone)")
    .eq("status", "due")
    .is("last_contacted_at", null)
    .lte("due_date", limit);
  for (const r of data ?? []) {
    const p = r.patients;
    if (!p || !r.visit_types) continue;
    const vt = await loadVisitType(r.visit_types.code);
    if (!vt) continue;
    const slots = await threeSlots(vt, now);
    await db().from("recalls").update({ status: "contacted", last_contacted_at: now.toISOString() }).eq("id", r.id).eq("status", "due");
    await sendMessage(
      { patient_id: p.id, channel: "sms", template: "recall_reminder", to_address: p.phone, body: `Hi ${p.first_name}, you're due for your ${vt.name.toLowerCase()} with Dr. Rahman.${slots.length ? ` Open times: ${slots.join("; ")}.` : ""} Book here: ${base}/book`, rule: "recall" },
      now,
    );
    s.recalls++;
    await logRun("recall", MINUTES.recall, now, { recall_id: r.id, text: `Sent ${p.first_name} ${p.last_name} a reminder that their ${vt.name.toLowerCase()} is due.` });
  }
}

async function taskReplies(now: Date, s: RunSummary) {
  const { data: tasks } = await db().from("tasks").select("id,kind,patient_id,contact_name,contact_phone,created_at").eq("status", "open");
  const labels: Record<string, string> = { refill: "refill request", records: "records request", billing: "billing question", callback: "callback request" };
  for (const t of tasks ?? []) {
    if (!t.contact_phone) continue;
    const { count } = await db().from("messages").select("id", { count: "exact", head: true }).eq("template", "task_auto_reply").eq("to_address", t.contact_phone).gte("sent_at", t.created_at);
    if (count) continue;
    const first = (t.contact_name ?? "there").split(" ")[0];
    await sendMessage(
      { patient_id: t.patient_id, channel: "sms", template: "task_auto_reply", to_address: t.contact_phone, body: `Hi ${first}, Brightleaf got your ${labels[t.kind]}. We'll reply within 1 business day.`, rule: "task_routing" },
      now,
    );
    s.task_replies++;
    await logRun("task_routing", MINUTES.task_routing, now, { task_id: t.id, text: `Routed ${t.contact_name ?? "a"}'s ${labels[t.kind]} to Jen and sent an auto-reply.` });
  }
}

export async function runAutomations(now: Date, base: string): Promise<RunSummary> {
  const s = empty();
  await expireOffers(now, base, s);
  await appointmentRules(now, base, s);
  await sickOpening(now, base, s);
  await leadNudges(now, base, s);
  await recalls(now, base, s);
  await taskReplies(now, s);
  return s;
}

export function summaryText(s: RunSummary): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => n && parts.push(`${n} ${n === 1 ? one : many}`);
  add(s.reminders, "reminder sent", "reminders sent");
  add(s.released, "visit released", "visits released");
  add(s.offers, "waitlist offer", "waitlist offers");
  add(s.expired, "offer expired", "offers expired");
  add(s.nudges, "lead nudged", "leads nudged");
  add(s.recalls, "recall sent", "recalls sent");
  add(s.sick_alerts, "sick-slot alert", "sick-slot alerts");
  add(s.task_replies, "task auto-reply", "task auto-replies");
  return parts.length ? parts.join(", ") : "Nothing new to do";
}
