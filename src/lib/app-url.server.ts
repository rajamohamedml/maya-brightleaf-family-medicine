// Single source for public links in messages. APP_URL wins; otherwise the site's public origin for this request.
const isLocal = (h: string) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(h);

export function resolveAppUrl(req?: Request | null): string {
  const env = process.env.APP_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (!req) return "";
  const h = req.headers;
  const fwd = h.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (fwd && !isLocal(fwd.split(":")[0])) return `${h.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"}://${fwd}`;
  for (const k of ["origin", "referer"]) {
    const v = h.get(k);
    if (!v) continue;
    try {
      const u = new URL(v);
      if (!isLocal(u.hostname)) return u.origin;
    } catch {}
  }
  return new URL(req.url).origin;
}
