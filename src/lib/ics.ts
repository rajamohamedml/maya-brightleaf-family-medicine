// Build and download a calendar (.ics) file in the browser.
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

export function downloadIcs(o: { title: string; start: string; end: string; location: string; description: string }) {
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brightleaf Family Medicine//Maya//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(o.start)}-${Math.random().toString(36).slice(2)}@brightleaf.example`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(o.start)}`,
    `DTEND:${stamp(o.end)}`,
    `SUMMARY:${esc(o.title)}`,
    `LOCATION:${esc(o.location)}`,
    `DESCRIPTION:${esc(o.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "brightleaf-visit.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
