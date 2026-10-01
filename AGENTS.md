<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules
- Demo reset: SQL `public.seed_demo()` (service role only), called only by staff-checked `resetDemo` — one idempotent reset point.
- Public clinic facts: `src/lib/clinic-info.ts` — anon has no table access.
- Shared UI in `src/components/maya/`; token dark theme in `src/styles.css` (cta coral, primary teal) — one accessible system.
- `/clinic` layout route: full-width workspace with one horizontal, scrollable staff navigation row on all screen sizes.
- Slot math only in `src/lib/scheduling.server.ts`; patient actions via zod server fns in `src/lib/booking.functions.ts` — one scheduling brain; DB exclusion constraint is the final double-booking guard.
- Clinic time via `src/lib/tz.ts` (Intl, America/Chicago) — no date library.
- Staff data via `src/lib/staff.functions.ts` (auth + has_role 'staff') plus staff-only RLS — two guards.
- Automations: `src/lib/automations.server.ts` (idempotent, simulated time), run by staff demo clock or cron route `/api/public/hooks/run-automations` — no edge functions.
- Maya chat: route `/api/maya-chat` (`src/lib/maya-chat.server.ts`); tools reuse booking server fns; keyword red-flag gate before any model call — safety server-side.
- Message links via `resolveAppUrl` (`src/lib/app-url.server.ts`): APP_URL else request public origin — works in preview and published.
