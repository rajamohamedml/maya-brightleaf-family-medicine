// Calendar links: open the visit in Google Calendar or Outlook (no file download).
export type CalEvent = { title: string; start: string; end: string; location: string; description: string };

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function googleCalendarUrl(o: CalEvent) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: o.title,
    dates: `${stamp(o.start)}/${stamp(o.end)}`,
    details: o.description,
    location: o.location,
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

export function outlookCalendarUrl(o: CalEvent) {
  const p = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: o.title,
    startdt: new Date(o.start).toISOString(),
    enddt: new Date(o.end).toISOString(),
    body: o.description,
    location: o.location,
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`;
}
