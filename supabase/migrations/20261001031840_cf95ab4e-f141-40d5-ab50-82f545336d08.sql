REVOKE ALL ON FUNCTION public.seed_demo() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo() TO service_role;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS offered_visit_code text;
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS offered_appointment_id uuid;