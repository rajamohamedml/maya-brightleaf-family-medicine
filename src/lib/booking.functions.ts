import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  BLOCKING_STATUSES,
  checkEligibility,
  computeSlots,
  db,
  findPatient,
  findSlot,
  getNow,
  loadVisitType,
  nextSlots,
  normalizePhone,
  type Slot,
} from "./scheduling.server";
import { visitCodeForReason, WHAT_TO_BRING } from "./booking-rules";
import { fmtSlot, localDateStr } from "./tz";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const phone = z.string().trim().refine((p) => p.replace(/\D/g, "").length >= 10, "Enter a 10-digit phone number");
const mode = z.enum(["in_person", "telehealth"]);
const windowSchema = z.enum(["am", "pm", "any"]);
const token = z.string().trim().min(16).max(64);

type Err = { error: string; message: string };
const err = (error: string, message: string): Err => ({ error, message });

const ELIGIBILITY_MSG: Record<string, string> = {
  mode_not_allowed: "That visit type isn't offered that way.",
  new_only: "New patient visits are only for people new to the clinic.",
  established_only: "This visit is for current patients. New patients start with a New patient visit.",
  insurer_only: "This visit is only for Medicare members.",
};

const toSlotDto = (s: Slot) => ({ start_at: s.start_at, end_at: s.end_at, label: fmtSlot(s.start_at) });

function origin() {
  try {
    return new URL(getRequest().url).origin;
  } catch {
    return "";
  }
}

async function logRun(rule: string, minutes: number, details: Record<string, unknown>) {
  await db().from("automation_runs").insert({ rule, actions_count: 1, minutes_saved: minutes, details: details as never });
}

/* ---------- resolve visit type from reason ---------- */
export const resolveVisit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        reason: z.enum(["physical", "new_patient", "follow_up", "sick", "telehealth"]),
        returning: z.object({ dob: dateStr, phone }).optional(),
        insurer: z.string().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    let isNew = true;
    let insurer = data.insurer ?? null;
    if (data.returning) {
      const p = await findPatient(data.returning.dob, data.returning.phone);
      if (!p) return err("not_found", "We couldn't find you. Please check your details or book as a new patient.");
      isNew = p.is_new;
      insurer = p.insurer;
    }
    const vt = await loadVisitType(visitCodeForReason(data.reason, insurer));
    if (!vt) return err("unknown_visit_type", "That visit type isn't available.");
    const defaultMode = vt.modes.includes("in_person") ? "in_person" : "telehealth";
    const elig = checkEligibility(vt, defaultMode, isNew, insurer);
    return {
      code: vt.code,
      name: vt.name,
      minutes: vt.minutes,
      modes: vt.modes as ("in_person" | "telehealth")[],
      patient_is_new: isNew,
      eligibility: elig,
      eligibility_message: elig ? ELIGIBILITY_MSG[elig] : null,
    };
  });

/* ---------- get-availability ---------- */
export const getAvailability = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        visit_type_code: z.string().max(40),
        patient_is_new: z.boolean(),
        mode,
        from_date: dateStr.optional(),
        days: z.number().int().min(1).max(21).default(14),
        window: windowSchema.default("any"),
        exclude_token: token.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const vt = await loadVisitType(data.visit_type_code);
    if (!vt) return err("unknown_visit_type", "That visit type isn't available.");
    const elig = checkEligibility(vt, data.mode, data.patient_is_new);
    if (elig) return err(elig, ELIGIBILITY_MSG[elig]);
    let excludeId: string | undefined;
    if (data.exclude_token) {
      const { data: a } = await db().from("appointments").select("id").eq("manage_token", data.exclude_token).maybeSingle();
      excludeId = a?.id;
    }
    const now = await getNow();
    const slots = await computeSlots({
      vt,
      mode: data.mode,
      fromDate: data.from_date ?? localDateStr(now),
      days: data.days,
      window: data.window,
      now,
      excludeAppointmentId: excludeId,
    });
    const groups: { date: string; slots: ReturnType<typeof toSlotDto>[] }[] = [];
    for (const s of slots) {
      const g = groups.at(-1);
      if (g && g.date === s.date) g.slots.push(toSlotDto(s));
      else groups.push({ date: s.date, slots: [toSlotDto(s)] });
    }
    return { groups, total: slots.length };
  });

/* ---------- book-appointment ---------- */
const patientInput = z.object({
  first_name: z.string().trim().max(60).optional(),
  last_name: z.string().trim().max(60).optional(),
  dob: dateStr,
  phone,
  email: z.string().trim().email("Enter a valid email").max(120).optional(),
  insurer: z.string().trim().max(80).optional(),
});

async function findOrCreatePatient(p: z.infer<typeof patientInput>) {
  const found = await findPatient(p.dob, p.phone);
  if (found) return { patient: found };
  if (!p.first_name || !p.last_name || !p.email || !p.insurer)
    return { error: err("missing_details", "Please fill in your name, email and insurance.") };
  if (p.insurer === "Medicaid")
    return { error: err("insurance_not_accepted", "We're not able to accept Medicaid at this time.") };
  const { data, error } = await db()
    .from("patients")
    .insert({
      first_name: p.first_name,
      last_name: p.last_name,
      dob: p.dob,
      phone: normalizePhone(p.phone),
      email: p.email,
      insurer: p.insurer,
      is_new: true,
    })
    .select("id,first_name,last_name,email,phone,insurer,is_new")
    .single();
  if (error) throw error;
  return { patient: data };
}

export const bookAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        patient: patientInput,
        visit_type_code: z.string().max(40),
        start_at: z.string().datetime({ offset: true }),
        mode,
        reason_category: z.enum(["new_patient", "physical", "follow_up", "sick", "telehealth", "other"]),
        source: z.enum(["form", "chat", "voice", "staff", "waitlist"]).default("form"),
        lead_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const vt = await loadVisitType(data.visit_type_code);
    if (!vt) return err("unknown_visit_type", "That visit type isn't available.");
    const res = await findOrCreatePatient(data.patient);
    if (res.error) return res.error;
    const patient = res.patient!;
    const elig = checkEligibility(vt, data.mode, patient.is_new, patient.insurer);
    if (elig) return err(elig, ELIGIBILITY_MSG[elig]);

    const now = await getNow();
    const taken = async () => ({
      error: "slot_taken",
      message: "Sorry, that time was just taken. Here are the next open times.",
      alternatives: (await nextSlots({ vt, mode: data.mode, after: data.start_at, now })).map(toSlotDto),
    });

    const slot = await findSlot({ vt, mode: data.mode, startAt: data.start_at, now });
    if (!slot) return taken();

    // The exclusion constraint is the atomic guard against a race between check and insert.
    const { data: appt, error } = await db()
      .from("appointments")
      .insert({
        patient_id: patient.id,
        visit_type_id: vt.id,
        start_at: slot.start_at,
        end_at: slot.end_at,
        mode: data.mode,
        status: "confirmed",
        reason_category: data.reason_category,
        source: data.source,
        intake_status: "not_started",
      })
      .select("id,manage_token,start_at,end_at,mode,status,intake_status")
      .single();
    if (error) {
      if (error.code === "23P01") return taken();
      throw error;
    }

    const base = origin();
    const manage = `${base}/visit/${appt.manage_token}`;
    const intake = `${base}/intake/${appt.manage_token}`;
    const when = fmtSlot(appt.start_at);
    await db()
      .from("messages")
      .insert({
        patient_id: patient.id,
        appointment_id: appt.id,
        channel: "email",
        template: "booking_confirmation",
        to_address: patient.email,
        subject: `You're booked: ${vt.name} on ${when}`,
        body: [
          `Hi ${patient.first_name}, your ${vt.name} with Dr. Rahman is confirmed for ${when} (Central Time).`,
          data.mode === "telehealth" ? "This is a video visit. We'll send the link before your visit." : "Location: 100 Brightleaf Way, Irving, TX 75039 (fictional).",
          `Manage your visit: ${manage}`,
          `Complete your intake form: ${intake}`,
          `Please bring: ${WHAT_TO_BRING.join(", ")}.`,
        ].join("\n"),
        rule: "instant_confirmation",
      });
    if (data.source !== "staff") await logRun("self_service_booking", 6, { appointment_id: appt.id });
    if (data.lead_id) await db().from("leads").update({ converted_appointment_id: appt.id }).eq("id", data.lead_id);

    return {
      ok: true as const,
      token: appt.manage_token,
      visit: {
        name: vt.name,
        start_at: appt.start_at,
        end_at: appt.end_at,
        mode: appt.mode,
        status: appt.status,
        first_name: patient.first_name,
      },
    };
  });

/* ---------- manage-appointment ---------- */
async function loadByToken(t: string) {
  const { data } = await db()
    .from("appointments")
    .select("id,patient_id,start_at,end_at,mode,status,intake_status,visit_type_id,visit_types(code,name,minutes,modes),patients(first_name,email,is_new,insurer)")
    .eq("manage_token", t)
    .maybeSingle();
  return data;
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadByToken>>>;
const viewDto = (a: Loaded) => ({
  start_at: a.start_at,
  end_at: a.end_at,
  mode: a.mode,
  status: a.status,
  intake_status: a.intake_status,
  visit_type_code: a.visit_types?.code ?? "",
  visit_name: a.visit_types?.name ?? "Visit",
  minutes: a.visit_types?.minutes ?? 0,
  first_name: a.patients?.first_name ?? "",
  patient_is_new: a.patients?.is_new ?? false,
  can_change: (BLOCKING_STATUSES as readonly string[]).includes(a.status) && a.status !== "arrived",
});

export const manageAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        action: z.enum(["view", "reconfirm", "cancel", "reschedule"]),
        new_start_at: z.string().datetime({ offset: true }).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const a = await loadByToken(data.token);
    if (!a) return err("not_found", "We couldn't find this visit. Please check your link.");
    if (data.action === "view") return { ok: true as const, visit: viewDto(a) };

    const view = viewDto(a);
    if (!view.can_change) return err("not_changeable", "This visit can no longer be changed online. Please call the clinic.");
    const email = a.patients?.email ?? "";
    const msg = (template: string, subject: string, body: string) =>
      db().from("messages").insert({ patient_id: a.patient_id, appointment_id: a.id, channel: "email", template, to_address: email, subject, body, rule: "patient_self_service" });

    if (data.action === "reconfirm") {
      if (a.status === "reconfirmed") return { ok: true as const, visit: view };
      await db().from("appointments").update({ status: "reconfirmed", reconfirmed_at: new Date().toISOString() }).eq("id", a.id);
    } else if (data.action === "cancel") {
      await db().from("appointments").update({ status: "cancelled" }).eq("id", a.id);
      await msg("cancellation", "Your visit is cancelled", `Your ${view.visit_name} on ${fmtSlot(a.start_at)} is cancelled. The time is now open for others.`);
    } else {
      if (!data.new_start_at) return err("missing_time", "Please choose a new time.");
      const vt = await loadVisitType(view.visit_type_code);
      if (!vt) return err("unknown_visit_type", "That visit type isn't available.");
      const now = await getNow();
      const slot = await findSlot({ vt, mode: a.mode, startAt: data.new_start_at, now, excludeAppointmentId: a.id });
      const alternatives = async () => (await nextSlots({ vt, mode: a.mode, after: data.new_start_at!, now, excludeAppointmentId: a.id })).map(toSlotDto);
      if (!slot) return { error: "slot_taken", message: "Sorry, that time was just taken.", alternatives: await alternatives() };
      const { error } = await db()
        .from("appointments")
        .update({ start_at: slot.start_at, end_at: slot.end_at, status: "confirmed", reconfirmed_at: null })
        .eq("id", a.id);
      if (error) {
        if (error.code === "23P01") return { error: "slot_taken", message: "Sorry, that time was just taken.", alternatives: await alternatives() };
        throw error;
      }
      await msg("reschedule", "Your visit has moved", `Your ${view.visit_name} moved from ${fmtSlot(a.start_at)} to ${fmtSlot(slot.start_at)} (Central Time).`);
    }
    const updated = await loadByToken(data.token);
    return { ok: true as const, visit: viewDto(updated!) };
  });

/* ---------- submit-intake ---------- */
const optText = z.string().trim().max(500);
export const submitIntake = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token,
        data: z.object({
          address: z.string().trim().min(5, "Enter your home address").max(200),
          emergency_name: z.string().trim().min(2, "Enter a contact name").max(80),
          emergency_phone: phone,
          pharmacy: z.string().trim().min(2, "Enter a pharmacy").max(120),
          medications: optText,
          medications_none: z.boolean(),
          allergies: optText,
          allergies_none: z.boolean(),
          consent: z.literal(true, { errorMap: () => ({ message: "Please tick the box to continue" }) }),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const a = await loadByToken(data.token);
    if (!a) return err("not_found", "We couldn't find this visit.");
    await db().from("intake_forms").insert({ appointment_id: a.id, patient_id: a.patient_id, data: data.data as never });
    await db().from("appointments").update({ intake_status: "done" }).eq("id", a.id);
    return { ok: true as const };
  });

/* ---------- join-waitlist ---------- */
export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        patient: patientInput,
        visit_type_codes: z.array(z.string().max(40)).min(1).max(6),
        earliest_date: dateStr.optional(),
        latest_date: dateStr.optional(),
        window: windowSchema.default("any"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await findOrCreatePatient(data.patient);
    if (res.error) return res.error;
    const now = await getNow();
    const today = localDateStr(now);
    const earliest = data.earliest_date ?? today;
    const { addDays } = await import("./tz");
    await db().from("waitlist").insert({
      patient_id: res.patient!.id,
      visit_type_codes: data.visit_type_codes,
      earliest_date: earliest,
      latest_date: data.latest_date ?? addDays(earliest, 14),
      window: data.window,
    });
    return { ok: true as const };
  });

/* ---------- create-task ---------- */
export const createTask = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "Enter your name").max(80),
        phone,
        kind: z.enum(["refill", "records", "billing", "callback"]),
        details: z.string().trim().max(200).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ph = normalizePhone(data.phone);
    const { data: p } = await db().from("patients").select("id").eq("phone", ph).limit(1).maybeSingle();
    const labels = { refill: "Refill request", records: "Records request", billing: "Billing question", callback: "Callback request" };
    const { data: task, error } = await db()
      .from("tasks")
      .insert({
        patient_id: p?.id ?? null,
        kind: data.kind,
        summary: data.details ? `${labels[data.kind]}: ${data.details}` : labels[data.kind],
        contact_name: data.name,
        contact_phone: ph,
      })
      .select("id")
      .single();
    if (error) throw error;
    await db().from("messages").insert({
      patient_id: p?.id ?? null,
      channel: "sms",
      template: "task_auto_reply",
      to_address: ph,
      body: `Hi ${data.name.split(" ")[0]}, Brightleaf got your ${labels[data.kind].toLowerCase()}. We'll reply within 1 business day.`,
      rule: "task_routing",
    });
    await logRun("task_routing", 4, { task_id: task.id });
    return { ok: true as const };
  });

/* ---------- lookup-patient ---------- */
export const lookupPatient = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ dob: dateStr, phone }).parse(d))
  .handler(async ({ data }) => {
    const p = await findPatient(data.dob, data.phone);
    return p ? { exists: true, first_name: p.first_name } : { exists: false, first_name: null };
  });

/* ---------- lead tracking ---------- */
export const upsertLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        step_reached: z.enum(["reason", "safety", "patient", "choose_time", "review"]),
        reason_category: z.enum(["new_patient", "physical", "follow_up", "sick", "telehealth", "other"]).optional(),
        first_name: z.string().trim().max(60).optional(),
        last_name: z.string().trim().max(60).optional(),
        phone: z.string().trim().max(30).optional(),
        email: z.string().trim().max(120).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const row = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== ""));
    const payload = { ...row, last_activity_at: new Date().toISOString(), source: "form" as const };
    if (id) {
      const { data: upd } = await db().from("leads").update(payload).eq("id", id).is("converted_appointment_id", null).select("id").maybeSingle();
      if (upd) return { id: upd.id };
    }
    const { data: ins, error } = await db().from("leads").insert(payload as never).select("id").single();
    if (error) throw error;
    return { id: ins.id };
  });
