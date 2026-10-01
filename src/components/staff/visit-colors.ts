export const VISIT_TINT: Record<string, string> = {
  new_patient: "visit-teal",
  physical: "visit-sky",
  medicare_awv: "visit-violet",
  follow_up: "visit-amber",
  sick: "visit-rose",
  telehealth: "visit-cyan",
};

export const minToLabel = (m: number) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
