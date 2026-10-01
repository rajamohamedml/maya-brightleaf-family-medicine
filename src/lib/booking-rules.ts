// Client-safe booking rules shared by the wizard and the server.
export type ReasonKey = "physical" | "new_patient" | "follow_up" | "sick" | "telehealth" | "other";

export const REASONS: { key: ReasonKey; label: string; hint: string }[] = [
  { key: "physical", label: "Annual physical", hint: "Yearly check-up" },
  { key: "new_patient", label: "New to the clinic", hint: "First visit with Dr. Rahman" },
  { key: "follow_up", label: "Follow-up", hint: "Ongoing care, current patients" },
  { key: "sick", label: "Feeling sick today", hint: "Same-day morning visit" },
  { key: "telehealth", label: "Telehealth", hint: "Quick video visit" },
  { key: "other", label: "Something else", hint: "Refill, records or billing" },
];

export function visitCodeForReason(reason: Exclude<ReasonKey, "other">, insurer?: string | null): string {
  if (reason === "physical") return insurer === "Medicare" ? "medicare_awv" : "physical";
  return reason;
}

export const SAFETY_QUESTION =
  "Right now, do you have chest pain, trouble breathing, signs of a stroke, heavy bleeding, or thoughts of harming yourself?";

export const EMERGENCY_MESSAGE = "Call 911 now. For a mental health crisis, call or text 988.";

export const INSURER_OPTIONS = [
  "Aetna",
  "Blue Cross Blue Shield of Texas",
  "UnitedHealthcare",
  "Cigna",
  "Medicare",
  "Self-pay",
  "Medicaid",
];

export const WHAT_TO_BRING = ["Photo ID", "Insurance card", "List of your medicines"];
