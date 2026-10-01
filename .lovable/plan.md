# Maya — Brightleaf Family Medicine

Build the complete app described in the project spec: an AI front desk ("Maya") for the fictional Brightleaf Family Medicine clinic in Las Colinas, Irving, TX. Goal: turn an inbound "can I get in?" into a confirmed visit with minimal owner effort.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud, then one migration that creates all tables with GRANTs + RLS in the same file:

- `clinic_settings` (single row incl. `demo_now` timestamptz — when set, it is "now" everywhere)
- `visit_types` (6 types with minutes, mode, rules)
- `schedule_blocks` (lunch / blocked / telehealth_only / sick_hold)
- `patients` (first_name, last_name, dob, phone, email, insurer, is_new, no_show_count)
- `appointments` (patient_id, visit_type_id, start_at/end_at timestamptz, mode, status, reason_category, source, manage_token, intake_status, reconfirmed_at)
  - Postgres exclusion constraint: no overlapping slot-blocking appointments (confirmed / reconfirmed / arrived)
- `intake_forms`, `waitlist` (status, window am/pm/any, offer_expires_at), `leads` (step_reached, last_activity_at, nudged_at, converted_appointment_id), `recalls`, `tasks` (refill/records/billing/callback), `messages` (outbox), `automation_runs` (rule, actions_count, minutes_saved)

RLS: every table locked down; public users never read tables directly. Public actions go through server functions/server routes that validate with zod and check tokens. Staff pages under `/clinic` require login (auth gate). Status flow: confirmed → reconfirmed → arrived → completed; exits cancelled / released / no_show.

Seed the migration with the clinic's fictional demo data: settings row, 6 visit types, schedule blocks (lunch, Wed PM telehealth-only, sick_hold), a few demo patients/appointments.

## 2. Shared scheduling server module

One server-side module (`*.server.ts`) owning all scheduling logic, used by every server function:
- Hours: Mon–Thu 8–5, Fri 8–3, lunch 12–1, closed Sat/Sun; Wed 1–5 telehealth-only; 5-minute buffer after each in-person visit; candidate starts every 15 minutes
- Visit-type rules: new_patient (max 2/day, latest start 3pm), physical (latest 10am, once per 12 months), medicare_awv (Medicare only, latest 11am), follow_up (established), sick (same-day only, after 7am, in the 8:00–9:30 sick_hold), telehealth (established, any open slot)
- Reason → visit-type mapping; "something else" (refill/records/billing) creates a task, no booking
- Insurance rules: accepted list; Medicaid → kind message + callback task; self-pay pricing ($150 new / $95 follow-up)
- All logic and display in America/Chicago

## 3. Safety screening (applies to every booking path)

Before any booking, screen for emergencies (chest pain, trouble breathing, stroke signs, heavy bleeding, self-harm): stop, show "Call 911 now. For a mental health crisis, call or text 988.", offer no slots. Maya never gives medical advice — clinical questions become tasks. Collect only name, DOB, phone, email, insurer, reason category, day/time preference. Footer on every public page: "Demo with fictional data – do not enter real health information."

## 4. Public routes (code-split, lazy)

- `/` — landing: clinic intro, primary coral CTA to book, link to chat
- `/book` — wizard: one question per screen, inline validation, insurance + reason → visit type, only bookable options shown
- `/chat` — Maya chat (`?voice=1` voice variant; voice code loads only on "Talk to Maya" tap): one question at a time, big slot chips ("Tue Oct 6 · 9:15 AM", first available highlighted), emergency screening, aria-live
- `/visit/:token` — manage visit: reconfirm ("I'll be there"), cancel, intake link, status with colour + text + icon
- `/visit/offer/:id` — waitlist offer with 30-minute accept window
- `/intake/:token` — intake form (name/DOB/phone/email/insurer confirmed, not free-text symptoms)

## 5. Staff routes (login required, dense/scannable, one-tap actions, no modals)

- `/clinic` — Today board
- `/clinic/schedule` — week grid (plain CSS, fetches only the visible week)
- `/clinic/inbox` — tasks/messages queue
- `/clinic/activity` — automation runs + "minutes saved" bars (plain CSS bars; fictional-clinic estimates label)

## 6. Automations

Idempotent `POST /api/public/run-automations` route (verify caller, use `demo_now`), implementing: instant confirmation, intake chaser (48h/24h), confirm-or-release (48h ask, release at 18h; no-show history ⇒ 12h reconfirm window), waitlist refill (30-min offer window), sick-slot opening at 7am, lead nudge (2h inactive), recall (due within 7 days), task routing. Minutes-saved per action recorded in `automation_runs`.

## 7. Design system + UX

- Tokens in `src/styles.css`: bg #F8FAFC, white cards, 1px slate-200 border, 12px radius; primary teal #0F766E; coral #F97360 only for the main CTA; Inter 400/600, base 17px, nothing below 14px; 150–200ms motion with prefers-reduced-motion support
- One primary action per screen; sticky bottom action bar on mobile (390px-first); desktop max width 1100px
- WCAG AA: ≥44px tap targets, visible focus rings, labels on every input, aria-live for chat/status, full keyboard use
- Inline SVG logo/illustrations only — no raster images

## 8. Constraints

- Only React, Tailwind, needed shadcn/ui, lucide-react, date-fns + date-fns-tz, zod — no other libraries (ask before adding)
- Head metadata (title/description/og) on every content route; no polling faster than 30s; loading skeletons, empty states, error states, success toasts on every page

## Build order

1. Cloud + migration + seed, shared scheduling module
2. Public booking path (/book, slot logic, confirmation + manage token)
3. /chat with screening and safety rules
4. /visit, /intake, waitlist offer pages
5. Automations route + messages
6. Staff routes behind login
7. Polish pass: a11y, skeletons, toasts, head metadata; verify flows end-to-end
