// Static, public clinic facts (fictional). Mirrors the seeded clinic_settings / visit_types.
export type VisitMode = "in_person" | "telehealth";

export const CLINIC = {
  name: "Brightleaf Family Medicine",
  doctor: "Dr. Aisha Rahman, MD",
  address: "100 Brightleaf Way, Irving, TX 75039 (fictional)",
  phone: "(214) 555-0100",
};

export const VISIT_TYPES: {
  code: string;
  name: string;
  minutes: number;
  modes: VisitMode[];
  note: string;
}[] = [
  {
    code: "new_patient",
    name: "New patient visit",
    minutes: 60,
    modes: ["in_person"],
    note: "For people new to the clinic",
  },
  {
    code: "physical",
    name: "Annual physical",
    minutes: 40,
    modes: ["in_person"],
    note: "Morning visits, once a year",
  },
  {
    code: "medicare_awv",
    name: "Medicare Annual Wellness",
    minutes: 40,
    modes: ["in_person"],
    note: "For Medicare members",
  },
  {
    code: "follow_up",
    name: "Chronic care follow-up",
    minutes: 20,
    modes: ["in_person", "telehealth"],
    note: "For current patients",
  },
  {
    code: "sick",
    name: "Sick visit (same-day)",
    minutes: 15,
    modes: ["in_person"],
    note: "Book the same morning",
  },
  {
    code: "telehealth",
    name: "Telehealth quick visit",
    minutes: 15,
    modes: ["telehealth"],
    note: "For current patients",
  },
];

export const INSURERS = [
  "Aetna",
  "Blue Cross Blue Shield of Texas",
  "UnitedHealthcare",
  "Cigna",
  "Medicare",
  "Self-pay",
];

export const HOURS = [
  { days: "Mon–Thu", time: "8:00 AM – 5:00 PM" },
  { days: "Fri", time: "8:00 AM – 3:00 PM" },
  { days: "Sat–Sun", time: "Closed" },
];

// Voice is available from Maya's unified chat composer.
export const VOICE_ENABLED = true;
