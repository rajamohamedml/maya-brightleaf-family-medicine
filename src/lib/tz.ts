// Timezone helpers for America/Chicago using only Intl (works in browser and server).
export const CLINIC_TZ = "America/Chicago";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: CLINIC_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date) {
  const p: Record<string, number> = {};
  for (const x of partsFmt.formatToParts(d)) if (x.type !== "literal") p[x.type] = Number(x.value);
  const g = (k: string) => p[k] ?? 0;
  const h = g("hour");
  return { y: g("year"), m: g("month"), d: g("day"), h: h === 24 ? 0 : h, mi: g("minute") };
}

const ymd = (date: string): [number, number, number] => {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  return [y, m, d];
};
const pad = (n: number) => String(n).padStart(2, "0");

/** Local clinic date as YYYY-MM-DD. */
export function localDateStr(d: Date): string {
  const p = parts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Minutes since local midnight. */
export function localMinutes(d: Date): number {
  const p = parts(d);
  return p.h * 60 + p.mi;
}

function offsetMs(t: number): number {
  const p = parts(new Date(t));
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  return asUtc - Math.floor(t / 60000) * 60000;
}

/** Convert a local clinic date + minutes after midnight to a UTC Date. */
export function zonedToUtc(date: string, minutes: number): Date {
  const [y, m, d] = ymd(date);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - offsetMs(guess);
  const t2 = guess - offsetMs(t);
  if (t2 !== t) t = t2;
  return new Date(t);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = ymd(date);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** ISO weekday 1=Mon..7=Sun for a YYYY-MM-DD date. */
export function isoDow(date: string): number {
  const [y, m, d] = ymd(date);
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return w === 0 ? 7 : w;
}

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TZ, weekday: "short", month: "short", day: "numeric" });
const longDayFmt = new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TZ, weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: CLINIC_TZ, hour: "numeric", minute: "2-digit" });

export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtLongDay = (iso: string) => longDayFmt.format(new Date(iso));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
/** "Tue, Oct 6 · 9:15 AM" */
export const fmtSlot = (iso: string) => `${fmtDay(iso)} · ${fmtTime(iso)}`;
