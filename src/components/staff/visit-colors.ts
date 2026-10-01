export const VISIT_TINT: Record<string, string> = {
  new_patient: "visit-teal",
  physical: "visit-sky",
  medicare_awv: "visit-violet",
  follow_up: "visit-amber",
  sick: "visit-rose",
  telehealth: "visit-cyan",
};

export const VISIT_SCHEDULE_COLOR: Record<string, string> = {
  new_patient: "bg-schedule-new border-schedule-new-border",
  physical: "bg-schedule-physical border-schedule-physical-border",
  medicare_awv: "bg-schedule-medicare border-schedule-medicare-border",
  follow_up: "bg-schedule-follow-up border-schedule-follow-up-border",
  sick: "bg-schedule-sick border-schedule-sick-border",
  telehealth: "bg-schedule-telehealth border-schedule-telehealth-border",
};

export const minToLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
