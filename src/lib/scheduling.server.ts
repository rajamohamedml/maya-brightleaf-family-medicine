// Shared scheduling brain. Every server function that reads or writes slots uses this module.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, isoDow, localDateStr, localMinutes, zonedToUtc } from "./tz";

export const BLOCKING_STATUSES = ["confirmed", "reconfirmed", "arrived"] as const;
const BUFFER_MIN = 5;
const STEP_MIN = 15;
const OPEN = 8 * 60;
const LUNCH = [12 * 60, 13 * 60] as const;
const SICK_HOLD = [8 * 60, 9 * 60 + 30] as const;
const TELE_ONLY_WED = [13 * 60, 17 * 60] as const;

export type VisitMode = "in_person" | "telehealth";
export type SlotWindow = "am" | "pm" | "any";

export type VisitTypeRow = {
  id: string;
  code: string;
  name: string;
  minutes: number;
  modes: string[];
  latest_start: string | null;
  max_per_day: number | null;
  new_only: boolean;
  established_only: boolean;
  insurer_only: string | null;
};

export type Slot = { start_at: string; end_at: string; date: string };

export const db = () => supabaseAdmin;

/** "Now" = clinic_settings.demo_now when set, else real time. */
export async function getNow(): Promise<Date> {
  const { data } = await supabaseAdmin.from("clinic_settings").select("demo_now").eq("id", 1).maybeSingle();
  return data?.demo_now ? new Date(data.demo_now) : new Date();
}

export async function loadVisitType(code: string): Promise<VisitTypeRow | null> {
  const { data } = await supabaseAdmin.from("visit_types").select("*").eq("code", code).maybeSingle();
  return (data as VisitTypeRow | null) ?? null;
}

export type EligibilityError = "mode_not_allowed" | "new_only" | "established_only" | "insurer_only";

export function checkEligibility(
  vt: VisitTypeRow,
  mode: VisitMode,
  isNew: boolean,
  insurer?: string | null,
): EligibilityError | null {
  if (!vt.modes.includes(mode)) return "mode_not_allowed";
  if (vt.new_only && !isNew) return "new_only";
  if (vt.established_only && isNew) return "established_only";
  if (vt.insurer_only && insurer !== undefined && insurer !== vt.insurer_only) return "insurer_only";
  return null;
}

const hm = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};
const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1;

export async function computeSlots(o: {
  vt: VisitTypeRow;
  mode: VisitMode;
  fromDate: string;
  days: number;
  window: SlotWindow;
  now: Date;
  excludeAppointmentId?: string;
}): Promise<Slot[]> {
  const { vt, mode, now } = o;
  const today = localDateStr(now);
  const from = o.fromDate < today ? today : o.fromDate;
  const to = addDays(from, o.days);
  const rangeStart = zonedToUtc(from, 0).toISOString();
  const rangeEnd = zonedToUtc(to, 0).toISOString();

  const [blocksRes, apptsRes] = await Promise.all([
    supabaseAdmin.from("schedule_blocks").select("kind,start_at,end_at").lt("start_at", rangeEnd).gt("end_at", rangeStart),
    supabaseAdmin
      .from("appointments")
      .select("id,start_at,end_at,mode,visit_type_id")
      .in("status", [...BLOCKING_STATUSES])
      .lt("start_at", rangeEnd)
      .gt("end_at", new Date(Date.parse(rangeStart) - 3600_000).toISOString()),
  ]);
  if (blocksRes.error) throw blocksRes.error;
  if (apptsRes.error) throw apptsRes.error;

  const blocks = (blocksRes.data ?? []).map((b) => ({ kind: b.kind, s: Date.parse(b.start_at), e: Date.parse(b.end_at) }));
  const appts = (apptsRes.data ?? [])
    .filter((a) => a.id !== o.excludeAppointmentId)
    .map((a) => ({
      s: Date.parse(a.start_at),
      e: Date.parse(a.end_at) + (a.mode === "in_person" ? BUFFER_MIN * 60_000 : 0),
      vt: a.visit_type_id,
      date: localDateStr(new Date(a.start_at)),
    }));

  const inPerson = mode === "in_person";
  const isSick = vt.code === "sick";
  const latest = vt.latest_start ? hm(vt.latest_start) : Infinity;
  const nowMs = now.getTime();
  const out: Slot[] = [];

  for (let d = from; d < to; d = addDays(d, 1)) {
    const dow = isoDow(d);
    if (dow > 5) continue;
    const close = dow === 5 ? 15 * 60 : 17 * 60;
    if (vt.max_per_day && appts.filter((a) => a.vt === vt.id && a.date === d).length >= vt.max_per_day) continue;
    // Sick visits: same day only, bookable from 7:00am.
    if (isSick && (d !== today || localMinutes(now) < 7 * 60)) continue;

    for (let m = OPEN; m + vt.minutes <= close; m += STEP_MIN) {
      if (m > latest) break;
      if (o.window === "am" && m >= LUNCH[0]) break;
      if (o.window === "pm" && m < LUNCH[1]) continue;
      const end = m + vt.minutes;
      // Fixed clinic rules (also mirrored by schedule_blocks).
      if (overlaps(m, end, LUNCH[0], LUNCH[1])) continue;
      const inSickHold = m >= SICK_HOLD[0] && end <= SICK_HOLD[1];
      if (isSick ? !inSickHold : overlaps(m, end, SICK_HOLD[0], SICK_HOLD[1])) continue;
      if (dow === 3 && inPerson && overlaps(m, end, TELE_ONLY_WED[0], TELE_ONLY_WED[1])) continue;

      const s = zonedToUtc(d, m).getTime();
      if (s <= nowMs) continue;
      const e = s + vt.minutes * 60_000;
      const busyEnd = e + (inPerson ? BUFFER_MIN * 60_000 : 0);

      let ok = true;
      for (const b of blocks) {
        if (!overlaps(s, e, b.s, b.e)) continue;
        if (b.kind === "lunch" || b.kind === "blocked") ok = false;
        else if (b.kind === "telehealth_only" && inPerson) ok = false;
        else if (b.kind === "sick_hold" && (!isSick || s < b.s || e > b.e)) ok = false;
        if (!ok) break;
      }
      if (!ok) continue;
      if (appts.some((a) => overlaps(s, busyEnd, a.s, a.e))) continue;
      out.push({ start_at: new Date(s).toISOString(), end_at: new Date(e).toISOString(), date: d });
    }
  }
  return out;
}

/** Is this exact start still bookable? Returns the slot if so. */
export async function findSlot(o: {
  vt: VisitTypeRow;
  mode: VisitMode;
  startAt: string;
  now: Date;
  excludeAppointmentId?: string;
}): Promise<Slot | null> {
  const date = localDateStr(new Date(o.startAt));
  const slots = await computeSlots({ ...o, fromDate: date, days: 1, window: "any" });
  const t = Date.parse(o.startAt);
  return slots.find((s) => Date.parse(s.start_at) === t) ?? null;
}

/** Next N valid slots at or after a given time. */
export async function nextSlots(o: {
  vt: VisitTypeRow;
  mode: VisitMode;
  after: string;
  now: Date;
  count?: number;
  excludeAppointmentId?: string;
}): Promise<Slot[]> {
  const from = localDateStr(new Date(o.after));
  const slots = await computeSlots({ ...o, fromDate: from, days: 14, window: "any" });
  const t = Date.parse(o.after);
  return slots.filter((s) => Date.parse(s.start_at) > t).slice(0, o.count ?? 3);
}

export function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : p.trim();
}

export async function findPatient(dob: string, phone: string) {
  const { data } = await supabaseAdmin
    .from("patients")
    .select("id,first_name,last_name,email,phone,insurer,is_new")
    .eq("dob", dob)
    .eq("phone", normalizePhone(phone))
    .limit(1)
    .maybeSingle();
  return data;
}
