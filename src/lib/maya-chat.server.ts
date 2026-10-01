// Maya chat agent: streams through Lovable AI Gateway and books only through the same server logic as the /book wizard.
import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId, withLovableAiGatewayRunIdHeader } from "./ai/run-id";
import {
  bookAppointment,
  changeMyVisit,
  createTask,
  findMyVisits,
  getAvailability,
  joinWaitlist,
  lookupPatient,
  upsertLead,
} from "./booking.functions";
import { CLINIC, HOURS, INSURERS, VISIT_TYPES } from "./clinic-info";
import { EMERGENCY_MESSAGE, WHAT_TO_BRING } from "./booking-rules";
import { getNow } from "./scheduling.server";
import { localDateStr, fmtLongDay } from "./tz";
import { resolveAppUrl } from "./app-url.server";

const MODEL = "openai/gpt-6-astra";

export const MAYA_SYSTEM_PROMPT =
  "You are Maya, the front desk assistant for Brightleaf Family Medicine in Las Colinas, Irving, TX (Dr. Aisha Rahman, MD). You schedule visits, answer clinic logistics (hours, location, insurance accepted, what to bring, telehealth) and route refills, records, billing and callback requests as tasks. You never give medical advice, diagnoses or medication guidance; for clinical questions, offer to create a task for Dr. Rahman's team. Call check_emergency on the patient's first message and whenever they describe symptoms. If it returns true, reply only: 'This sounds urgent. Please call 911 now. For a mental health crisis, call or text 988.' and do not offer times. Collect only: first and last name, date of birth, phone, email, insurer, reason, preferred days and morning/afternoon. Ask for missing details one or two at a time, never re-ask what you already have. Medicaid is not accepted: say so kindly and offer a callback task. Map the reason to a visit type using the clinic rules. Offer at most 3 times at once, soonest first. Before booking, read back the visit type, day, time and name and wait for a clear yes. After booking, say it is confirmed and share the manage and intake links. Be warm, brief and plain-spoken; 2-3 short sentences per reply. Patients can cancel or reschedule an upcoming visit with you. First verify them with date of birth and phone using find_my_visits. If they have more than one upcoming visit, ask which one. For reschedules, offer up to 3 new times for the same visit type, soonest first, honouring their morning/afternoon preference. Before cancelling or moving anything, read back the visit and the change and wait for a clear yes. After a change, confirm it and say we've sent the details by text and email. If a cancellation is less than 24 hours before the visit, still allow it, but gently mention that the clinic appreciates more notice. Never cancel or move a visit without explicit confirmation. Patients may correct anything at any time, e.g. 'No, I meant Thursday', 'Actually my phone is 214-555-0177', 'Make that the afternoon'. Accept the correction, update the detail, briefly confirm only the corrected item ('Got it — Thursday instead.'), and continue. Always use the latest value. Before booking, cancelling or rescheduling, read back the final details and wait for a clear yes; if they correct anything during the read-back, update it and read back again.";

function operationalNotes(today: string) {
  return `
Clinic rules for mapping reason to visit type: New to the clinic -> new_patient; Annual physical -> medicare_awv if insurer is Medicare, else physical; Follow-up -> follow_up (current patients only); Feeling sick today -> sick (same-day mornings only); Telehealth -> telehealth (current patients only, mode telehealth); refill/records/billing -> create_task, no booking.
Today in clinic time (America/Chicago) is ${today}. Dates are YYYY-MM-DD.
Only offer times returned by get_availability; never invent times. Use the exact start_at value from get_availability when booking. The app shows the times as tappable chips, so just mention them briefly.
Use lookup_patient with DOB and phone to tell returning patients from new ones. Once you know name and phone, call save_progress (and again when more details arrive); pass the lead_id to book_appointment.
For cancel/reschedule: find_my_visits returns visit ids; pass the same dob and phone plus that id to cancel_visit or reschedule_visit. For reschedule times call get_availability with the SAME visit_type_code and mode as the visit, patient_is_new from find_my_visits. The app shows visits as cards, so describe them briefly.
Use markdown links when sharing URLs.`;
}

function voiceNotes(isVoice: boolean, intr?: { sentence?: unknown; unsaid?: unknown }) {
  if (!isVoice) return "";
  let n = `
Voice call: after you capture a phone number or date of birth, repeat it back digit by digit (e.g. "two one four, five five five, zero one seven seven") and ask if that's right. Keep replies short and easy to hear; do not read out URLs.`;
  const sentence = typeof intr?.sentence === "string" ? intr.sentence.slice(0, 400) : "";
  const unsaid = Array.isArray(intr?.unsaid) ? intr.unsaid.filter((x): x is string => typeof x === "string").join(" ").slice(0, 800) : "";
  if (sentence || unsaid)
    n += `
The patient just interrupted you while you were speaking. You were cut off during: "${sentence}". Not yet said: "${unsaid}". Answer the interruption first. Then, only if the unsaid part is still relevant, continue briefly from where you stopped (e.g. "As I was saying, ...") without repeating what was already said. If the interruption changed the topic, corrected a detail or answered your question, drop the old remainder.`;
  return n;
}

const RED_FLAGS = [
  /chest (pain|pressure|tight)/i,
  /(can'?t|cannot|trouble|hard|difficulty|short(ness)? of) breath/i,
  /not breathing|choking/i,
  /stroke|face (is )?droop|slurred speech|numb(ness)? (on )?one side|arm weakness/i,
  /heavy bleeding|bleeding (a lot|heavily|won'?t stop)|bleeding badly/i,
  /suicid|kill myself|harm (myself|me)|hurt myself|end my life|self[- ]harm|want to die/i,
  /unconscious|passed out|seizure|overdose/i,
];
export const keywordEmergency = (text: string) => RED_FLAGS.some((r) => r.test(text));

function lastUserText(messages: UIMessage[]) {
  const m = [...messages].reverse().find((x) => x.role === "user");
  return m ? m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") : "";
}

function emergencyResponse() {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-emergency", data: { message: EMERGENCY_MESSAGE } } as never);
      writer.write({ type: "text-start", id: "t" });
      writer.write({ type: "text-delta", id: "t", delta: "This sounds urgent. Please call 911 now. For a mental health crisis, call or text 988." });
      writer.write({ type: "text-end", id: "t" });
      writer.write({ type: "finish" });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

/** LLM classifier: does this one message describe a current emergency? */
async function screenEmergencyText(provider: ReturnType<typeof createOpenAI>, text: string, reasoning: unknown) {
  const r = streamText({
    model: provider.responses(MODEL),
    system:
      "Answer only YES or NO. Does this message describe chest pain, trouble breathing, signs of a stroke, heavy bleeding, or thoughts of self-harm/suicide happening now?",
    prompt: text,
    providerOptions: { openai: reasoning },
  });
  return (await r.text).trim().toUpperCase().startsWith("YES");
}

const patientSchema = z.object({
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  dob: z.string().describe("YYYY-MM-DD"),
  phone: z.string(),
  email: z.string().nullable(),
  insurer: z.string().nullable(),
});
const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== "")) as { [K in keyof T]: Exclude<T[K], null> };

function safe<T>(fn: () => Promise<T>) {
  return fn().catch((e: unknown) => {
    const msg = e instanceof z.ZodError ? e.issues.map((i) => i.message).join("; ") : e instanceof Error ? e.message : "Something went wrong";
    return { error: "invalid_input", message: msg };
  });
}

export async function handleMayaChat(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as
    | { messages?: UIMessage[]; channel?: string; interruption?: { sentence?: unknown; unsaid?: unknown } }
    | null;
  const messages = Array.isArray(body?.messages) ? body!.messages.slice(-40) : [];
  const bookingSource = body?.channel === "voice" ? "voice" : "chat";
  if (!messages.length) return Response.json({ error: "No messages" }, { status: 400 });

  // Hard safety gate: a red flag in the newest patient message stops booking before any model call.
  // After an emergency was already handled, red-flag words in the newest message are screened by
  // the classifier below instead, so clarifications ("my dad had chest pain last year") pass
  // while a genuinely new emergency still repeats the 911 message.
  const latestUser = lastUserText(messages);
  const emergencyAlreadyHandled = messages.some((m) =>
    m.role === "assistant" &&
    m.parts.some(
      (p) =>
        p.type === "data-emergency" ||
        (p.type === "text" && p.text.includes("Please call 911 now")) ||
        (p.type === "tool-check_emergency" &&
          (p as { state?: string; output?: { emergency?: boolean } }).state === "output-available" &&
          (p as { output?: { emergency?: boolean } }).output?.emergency === true),
    ),
  );
  if (keywordEmergency(latestUser) && !emergencyAlreadyHandled) return emergencyResponse();

  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) return Response.json({ error: "AI is not configured" }, { status: 500 });

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const reasoning = {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  };

  const now = await getNow();
  const today = localDateStr(now);
  const base = resolveAppUrl(request);

  const tools = {
    check_emergency: tool({
      description: "Screen the patient's words for emergency red flags (chest pain, trouble breathing, stroke signs, heavy bleeding, thoughts of self-harm). Returns { emergency: boolean }.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        if (keywordEmergency(text)) return { emergency: true };
        const screenText =
          emergencyAlreadyHandled && latestUser.trim() ? latestUser : text;
        const r = streamText({
          model: provider.responses(MODEL),
          system:
            "Answer only YES or NO. Does this message describe chest pain, trouble breathing, signs of a stroke, heavy bleeding, or thoughts of self-harm/suicide happening now?",
          prompt: screenText,
          providerOptions: { openai: reasoning },
        });
        const out = (await r.text).trim().toUpperCase();
        return { emergency: out.startsWith("YES") };
      },
    }),
    lookup_patient: tool({
      description: "Check if a patient already exists by date of birth and phone. Returns first name only.",
      inputSchema: z.object({ dob: z.string().describe("YYYY-MM-DD"), phone: z.string() }),
      execute: (d) => safe(() => lookupPatient({ data: d })),
    }),
    save_progress: tool({
      description: "Save the patient's contact details as a lead so staff can follow up if they don't finish booking.",
      inputSchema: z.object({
        lead_id: z.string().nullable(),
        first_name: z.string().nullable(),
        last_name: z.string().nullable(),
        phone: z.string().nullable(),
        email: z.string().nullable(),
        reason_category: z.enum(["new_patient", "physical", "follow_up", "sick", "telehealth", "other"]).nullable(),
      }),
      execute: ({ lead_id, ...rest }) =>
        safe(() =>
          upsertLead({
            data: { ...clean(rest), ...(lead_id ? { id: lead_id } : {}), step_reached: "patient", source: "chat" },
          }).then((r) => ({ lead_id: r.id })),
        ),
    }),
    get_availability: tool({
      description: "Get the soonest real open times. Returns up to 3 slots with exact start_at values.",
      inputSchema: z.object({
        visit_type_code: z.enum(["new_patient", "physical", "medicare_awv", "follow_up", "sick", "telehealth"]),
        patient_is_new: z.boolean(),
        mode: z.enum(["in_person", "telehealth"]),
        window: z.enum(["am", "pm", "any"]),
        from_date: z.string().nullable().describe("YYYY-MM-DD or null for today"),
      }),
      execute: ({ from_date, ...d }) =>
        safe(async () => {
          const r = await getAvailability({ data: { ...d, days: 14, ...(from_date ? { from_date } : {}) } });
          if ("error" in r) return r;
          const slots = r.groups.flatMap((g) => g.slots).slice(0, 3);
          return { visit_type_code: d.visit_type_code, mode: d.mode, slots };
        }),
    }),
    book_appointment: tool({
      description: "Book a visit after the patient clearly said yes to the read-back.",
      inputSchema: z.object({
        patient: patientSchema,
        visit_type_code: z.enum(["new_patient", "physical", "medicare_awv", "follow_up", "sick", "telehealth"]),
        start_at: z.string(),
        mode: z.enum(["in_person", "telehealth"]),
        reason_category: z.enum(["new_patient", "physical", "follow_up", "sick", "telehealth"]),
        lead_id: z.string().nullable(),
      }),
      execute: ({ patient, lead_id, ...d }) =>
        safe(async () => {
          const r = await bookAppointment({
            data: { ...d, patient: clean(patient), source: bookingSource, ...(lead_id ? { lead_id } : {}) },
          });
          if (!("ok" in r)) return r;
          return {
            ok: true,
            visit: r.visit,
            manage_url: `${base}/visit/${r.token}`,
            intake_url: `${base}/intake/${r.token}`,
          };
        }),
    }),
    find_my_visits: tool({
      description: "Verify a patient by date of birth + phone and list only their upcoming confirmed visits. Returns found:false if no match.",
      inputSchema: z.object({ dob: z.string().describe("YYYY-MM-DD"), phone: z.string() }),
      execute: (d) => safe(() => findMyVisits({ data: d })),
    }),
    cancel_visit: tool({
      description: "Cancel a visit returned by find_my_visits, only after the patient clearly said yes.",
      inputSchema: z.object({ dob: z.string(), phone: z.string(), appointment_id: z.string(), reason: z.string().nullable() }),
      execute: ({ reason, ...d }) =>
        safe(() => changeMyVisit({ data: { ...d, action: "cancel", source: bookingSource, ...(reason ? { reason: reason.slice(0, 200) } : {}) } })),
    }),
    reschedule_visit: tool({
      description: "Move a visit returned by find_my_visits to a new start_at from get_availability, only after the patient clearly said yes.",
      inputSchema: z.object({ dob: z.string(), phone: z.string(), appointment_id: z.string(), new_start_at: z.string() }),
      execute: (d) => safe(() => changeMyVisit({ data: { ...d, action: "reschedule", source: bookingSource } })),
    }),
    join_waitlist: tool({
      description: "Add the patient to the waitlist when no time works.",
      inputSchema: z.object({
        patient: patientSchema,
        visit_type_codes: z.array(z.enum(["new_patient", "physical", "medicare_awv", "follow_up", "sick", "telehealth"])),
        earliest_date: z.string().nullable(),
        latest_date: z.string().nullable(),
        window: z.enum(["am", "pm", "any"]),
      }),
      execute: ({ patient, earliest_date, latest_date, ...d }) =>
        safe(() =>
          joinWaitlist({
            data: { ...d, patient: clean(patient), ...(earliest_date ? { earliest_date } : {}), ...(latest_date ? { latest_date } : {}) },
          }),
        ),
    }),
    create_task: tool({
      description: "Create a refill, records, billing or callback task for the clinic team.",
      inputSchema: z.object({
        name: z.string(),
        phone: z.string(),
        kind: z.enum(["refill", "records", "billing", "callback"]),
        details: z.string().describe("Short, no symptoms or medical history"),
      }),
      execute: (d) => safe(() => createTask({ data: { ...d, details: d.details.slice(0, 200) } }).then((r) => ({ ...r, kind: d.kind }))),
    }),
    get_clinic_info: tool({
      description: "Clinic hours, address, insurance, what to bring and telehealth info.",
      inputSchema: z.object({}),
      execute: async () => ({
        ...CLINIC,
        hours: HOURS,
        lunch: "12–1 PM daily",
        insurance_accepted: INSURERS,
        not_accepted: ["Medicaid"],
        self_pay: "New visit $150, follow-up $95",
        what_to_bring: WHAT_TO_BRING,
        telehealth: "Video visits for current patients. Wednesday afternoons (1–5 PM) are telehealth only.",
        visit_types: VISIT_TYPES,
        today: fmtLongDay(now.toISOString()),
      }),
    }),
  };

  const result = streamText({
    model: provider.responses(MODEL),
    system: MAYA_SYSTEM_PROMPT + "\n" + operationalNotes(today) + voiceNotes(bookingSource === "voice", body?.interruption),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(50),
    abortSignal: request.signal,
    providerOptions: { openai: reasoning },
  });

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      onError: (e) => {
        console.error("maya-chat", e);
        return "Maya is busy right now.";
      },
    }),
    runIdFetch,
  );
}
