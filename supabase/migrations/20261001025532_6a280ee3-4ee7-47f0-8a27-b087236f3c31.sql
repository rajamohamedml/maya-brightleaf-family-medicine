create type public.app_role as enum ('staff');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['appointments','automation_runs','clinic_settings','intake_forms','leads','messages','patients','recalls','schedule_blocks','tasks','visit_types','waitlist'] loop
    execute format('drop policy if exists "Staff full access" on public.%I', t);
    execute format('create policy "Staff full access" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''staff'')) with check (public.has_role(auth.uid(), ''staff''))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;