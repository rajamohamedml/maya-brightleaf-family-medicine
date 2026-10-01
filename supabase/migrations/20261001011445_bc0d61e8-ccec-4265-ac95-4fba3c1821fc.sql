create extension if not exists btree_gist with schema extensions;

create type public.visit_mode as enum ('in_person','telehealth');
create type public.appt_status as enum ('confirmed','reconfirmed','arrived','completed','cancelled','released','no_show');
create type public.block_kind as enum ('lunch','blocked','telehealth_only','sick_hold');
create type public.appt_source as enum ('form','chat','voice','staff','waitlist');
create type public.intake_status as enum ('not_started','done');
create type public.reason_category as enum ('new_patient','physical','follow_up','sick','telehealth','other');
create type public.waitlist_status as enum ('waiting','offered','accepted','expired');
create type public.waitlist_window as enum ('am','pm','any');
create type public.recall_status as enum ('due','contacted','booked','dismissed');
create type public.task_kind as enum ('refill','records','billing','callback');
create type public.task_status as enum ('open','done');
create type public.msg_channel as enum ('email','sms');

create table public.clinic_settings (
  id int primary key default 1 check (id = 1),
  clinic_name text not null default 'Brightleaf Family Medicine',
  doctor_name text not null default 'Dr. Aisha Rahman, MD',
  address text not null default '5221 N O''Connor Blvd, Las Colinas, Irving, TX 75039',
  phone text not null default '(214) 555-0100',
  timezone text not null default 'America/Chicago',
  buffer_minutes int not null default 5,
  slot_step_minutes int not null default 15,
  hours jsonb not null default '{}'::jsonb,
  accepted_insurers text[] not null default '{}',
  self_pay jsonb not null default '{}'::jsonb,
  demo_now timestamptz,
  updated_at timestamptz not null default now()
);

create table public.visit_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  minutes int not null,
  modes public.visit_mode[] not null,
  latest_start time,
  max_per_day int,
  new_only boolean not null default false,
  established_only boolean not null default false,
  insurer_only text,
  sort int not null default 0
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  kind public.block_kind not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text,
  check (end_at > start_at)
);
create index on public.schedule_blocks (start_at);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  dob date not null,
  phone text not null,
  email text not null,
  insurer text not null,
  is_new boolean not null default false,
  no_show_count int not null default 0,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_type_id uuid not null references public.visit_types(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode public.visit_mode not null default 'in_person',
  status public.appt_status not null default 'confirmed',
  reason_category public.reason_category not null,
  source public.appt_source not null default 'form',
  manage_token text not null unique default replace(gen_random_uuid()::text,'-',''),
  intake_status public.intake_status not null default 'not_started',
  reconfirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint appointments_no_overlap exclude using gist (tstzrange(start_at, end_at, '[)') with &&)
    where (status in ('confirmed','reconfirmed','arrived'))
);
create index on public.appointments (start_at);

create table public.intake_forms (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_type_codes text[] not null,
  earliest_date date not null,
  latest_date date not null,
  "window" public.waitlist_window not null default 'any',
  status public.waitlist_status not null default 'waiting',
  offered_start_at timestamptz,
  offer_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  phone text,
  email text,
  reason_category public.reason_category,
  source public.appt_source not null default 'form',
  step_reached text not null,
  last_activity_at timestamptz not null default now(),
  nudged_at timestamptz,
  converted_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.recalls (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_type_id uuid not null references public.visit_types(id),
  due_date date not null,
  status public.recall_status not null default 'due',
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  kind public.task_kind not null,
  status public.task_status not null default 'open',
  summary text not null,
  contact_name text,
  contact_phone text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.patients(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  channel public.msg_channel not null,
  template text not null,
  to_address text not null,
  subject text,
  body text not null,
  rule text,
  sent_at timestamptz not null default now()
);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  rule text not null,
  actions_count int not null default 0,
  minutes_saved int not null default 0,
  details jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['clinic_settings','visit_types','schedule_blocks','patients','appointments','intake_forms','waitlist','leads','recalls','tasks','messages','automation_runs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "Staff full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

create or replace function public.seed_demo()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  tz constant text := 'America/Chicago';
  today date := (now() at time zone tz)::date;
  monday date;
  d date;
  n int;
  i int;
  m int;
  close_m int;
  dur int;
  r float;
  vcode text;
  vmode public.visit_mode;
  vt record;
  pid uuid;
  s timestamptz;
  e timestamptz;
  np_count int;
  st public.appt_status;
  firsts text[] := array['Avery','Blake','Casey','Drew','Emery','Finley','Gray','Harper','Indy','Jules','Kai','Logan','Morgan','Noel','Oakley','Parker','Quinn','Reese','Sage','Tatum','Umi','Vale','Wren','Xen','Yael','Zion','Rowan','Skyler','Jordan','Remy','Ari','Bellamy','Cass','Dallas','Ellis','Frankie','Sam','Maria','Priya'];
  lasts text[] := array['Testwell','Sampleton','Demoford','Placeholder','Fakeley','Mockwood','Fictionson','Notreal','Pretendo','Exampleby','Dummond','Stubbs','Trialson','Mockridge','Sandbox','Prototype','Draftwell','Fauxman','Imagino','Madeup','Testa','Pseudo','Lorem','Ipsum','Dolor','Amet','Consect','Elitson','Vitae','Tempor','Sedley','Magna','Aliqua','Veniam','Nostrud','Laboris','Lee','Gomez','Nair'];
  insurers text[] := array['Aetna','Blue Cross Blue Shield of Texas','UnitedHealthcare','Cigna','Medicare','Self-pay','Blue Cross Blue Shield of Texas','Aetna'];
  sam uuid; maria uuid; priya uuid;
begin
  perform setseed(0.42);
  truncate public.automation_runs, public.messages, public.tasks, public.recalls, public.leads,
    public.waitlist, public.intake_forms, public.appointments, public.patients,
    public.schedule_blocks, public.visit_types, public.clinic_settings restart identity cascade;

  monday := today + ((8 - extract(isodow from today)::int) % 7);
  if monday = today then monday := today + 7; end if;

  insert into public.clinic_settings (id, hours, accepted_insurers, self_pay, demo_now) values (1,
    '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","15:00"],"lunch":["12:00","13:00"],"wed_telehealth_only":["13:00","17:00"],"sick_hold":["08:00","09:30"]}',
    array['Aetna','Blue Cross Blue Shield of Texas','UnitedHealthcare','Cigna','Medicare','Self-pay'],
    '{"new":150,"follow_up":95}',
    (monday + time '07:30') at time zone tz);

  insert into public.visit_types (code,name,minutes,modes,latest_start,max_per_day,new_only,established_only,insurer_only,sort) values
    ('new_patient','New patient visit',60,'{in_person}','15:00',2,true,false,null,1),
    ('physical','Annual physical',40,'{in_person}','10:00',null,false,false,null,2),
    ('medicare_awv','Medicare Annual Wellness',40,'{in_person}','11:00',null,false,false,'Medicare',3),
    ('follow_up','Chronic care follow-up',20,'{in_person,telehealth}',null,null,false,true,null,4),
    ('sick','Sick visit (same-day)',15,'{in_person}','09:15',null,false,false,null,5),
    ('telehealth','Telehealth quick visit',15,'{telehealth}',null,null,false,true,null,6);

  -- schedule blocks for next 21 clinic days
  d := today; n := 0;
  while n < 21 loop
    if extract(isodow from d) between 1 and 5 then
      insert into public.schedule_blocks (kind,start_at,end_at,note) values
        ('sick_hold',(d + time '08:00') at time zone tz,(d + time '09:30') at time zone tz,'Same-day sick visits'),
        ('lunch',(d + time '12:00') at time zone tz,(d + time '13:00') at time zone tz,'Lunch');
      if extract(isodow from d) = 3 then
        insert into public.schedule_blocks (kind,start_at,end_at,note) values
          ('telehealth_only',(d + time '13:00') at time zone tz,(d + time '17:00') at time zone tz,'Telehealth only');
      end if;
      n := n + 1;
    end if;
    d := d + 1;
  end loop;

  -- 40 patients
  for i in 1..40 loop
    insert into public.patients (first_name,last_name,dob,phone,email,insurer,is_new,no_show_count)
    values (
      firsts[1 + (i-1) % array_length(firsts,1)],
      lasts[1 + (i*7) % array_length(lasts,1)],
      date '1945-01-01' + (floor(random()*22000))::int,
      '214-555-01' || lpad(i::text,2,'0'),
      'patient' || i || '@example.com',
      insurers[1 + (i-1) % array_length(insurers,1)],
      (i % 4 = 0),
      case when i % 9 = 0 then 1 else 0 end);
  end loop;
  -- anchors (replace three patients' identities)
  update public.patients set first_name='Sam', last_name='Lee', is_new=true, insurer='Aetna', email='sam.lee@example.com', no_show_count=0
    where phone='214-555-0101' returning id into sam;
  update public.patients set first_name='Maria', last_name='Gomez', is_new=false, insurer='Blue Cross Blue Shield of Texas', email='maria.gomez@example.com'
    where phone='214-555-0102' returning id into maria;
  update public.patients set first_name='Priya', last_name='Nair', is_new=true, insurer='Cigna', email='priya.nair@example.com'
    where phone='214-555-0103' returning id into priya;

  insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status)
  select sam, id, (monday + 2 + time '10:00') at time zone tz, (monday + 2 + time '11:00') at time zone tz, 'in_person','confirmed','new_patient','form','not_started'
  from public.visit_types where code='new_patient';
  insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status)
  select maria, id, (monday + 1 + time '14:00') at time zone tz, (monday + 1 + time '14:20') at time zone tz, 'in_person','confirmed','follow_up','chat','done'
  from public.visit_types where code='follow_up';

  -- fill ~60% of the next 14 clinic days
  d := monday; n := 0;
  while n < 14 loop
    if extract(isodow from d) between 1 and 5 then
      close_m := case when extract(isodow from d) = 5 then 15*60 else 17*60 end;
      m := 9*60 + 30;
      while m < close_m loop
        if m >= 12*60 and m < 13*60 then m := 13*60; continue; end if;
        if random() < 0.62 then
          r := random();
          vmode := 'in_person';
          if extract(isodow from d) = 3 and m >= 13*60 then
            vcode := case when r < 0.5 then 'telehealth' else 'follow_up' end; vmode := 'telehealth';
          elsif m <= 10*60 and r < 0.25 then vcode := 'physical';
          elsif m <= 11*60 and r < 0.35 then vcode := 'medicare_awv';
          elsif m <= 15*60 and r < 0.5 then vcode := 'new_patient';
          elsif r < 0.85 then vcode := 'follow_up';
          else vcode := 'telehealth'; vmode := 'telehealth';
          end if;
          select * into vt from public.visit_types where code = vcode;
          if vcode = 'new_patient' then
            select count(*) into np_count from public.appointments a
              where a.visit_type_id = vt.id and (a.start_at at time zone tz)::date = d;
            if np_count >= 2 then vcode := 'follow_up'; select * into vt from public.visit_types where code = vcode; end if;
          end if;
          dur := vt.minutes;
          if (m < 12*60 and m + dur > 12*60) or m + dur > close_m then m := m + 15; continue; end if;
          s := (d + make_interval(mins => m)) at time zone tz;
          e := s + make_interval(mins => dur);
          if exists (select 1 from public.appointments a
                     where tstzrange(a.start_at, a.end_at + interval '5 minutes') && tstzrange(s, e + interval '5 minutes')) then
            m := m + 15; continue;
          end if;
          if vcode = 'new_patient' then
            select id into pid from public.patients where is_new and id not in (sam, priya) order by random() limit 1;
          elsif vcode = 'medicare_awv' then
            select id into pid from public.patients where insurer = 'Medicare' order by random() limit 1;
          else
            select id into pid from public.patients where not is_new and id <> maria order by random() limit 1;
          end if;
          st := case when random() < 0.25 then 'reconfirmed' else 'confirmed' end;
          insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status,reconfirmed_at)
          values (pid, vt.id, s, e, vmode, st,
            (case vcode when 'new_patient' then 'new_patient' when 'physical' then 'physical' when 'medicare_awv' then 'physical'
              when 'telehealth' then 'telehealth' else 'follow_up' end)::public.reason_category,
            (array['form','chat','voice','staff'])[1 + floor(random()*4)::int]::public.appt_source,
            case when random() < 0.5 then 'done' else 'not_started' end::public.intake_status,
            case when st = 'reconfirmed' then (monday + time '07:00') at time zone tz end);
          m := m + dur + 5;
          m := ((m + 14) / 15) * 15;
        else
          m := m + 15;
        end if;
      end loop;
      n := n + 1;
    end if;
    d := d + 1;
  end loop;

  -- waitlist (Priya first)
  insert into public.waitlist (patient_id,visit_type_codes,earliest_date,latest_date,"window",created_at)
    values (priya, '{new_patient,follow_up}', monday, monday + 7, 'any', (monday - 3 + time '09:00') at time zone tz);
  insert into public.waitlist (patient_id,visit_type_codes,earliest_date,latest_date,"window",created_at)
  select p.id,
    case when p.is_new then '{new_patient}'::text[] else '{follow_up}'::text[] end,
    monday, monday + 14,
    (array['am','pm','any'])[1 + (row_number() over () % 3)::int]::public.waitlist_window,
    (monday - 2 + time '09:00') at time zone tz + (row_number() over ()) * interval '1 hour'
  from (select * from public.patients where id not in (sam, maria, priya) order by phone limit 7 offset 10) p;

  -- abandoned leads
  insert into public.leads (first_name,last_name,phone,email,reason_category,source,step_reached,last_activity_at) values
    ('Jamie','Placeholder','214-555-0191','jamie.lead@example.com','new_patient','form','choose_time',(monday + time '07:30') at time zone tz - interval '3 hours'),
    ('Robin','Sampleton','214-555-0192','robin.lead@example.com','follow_up','chat','insurance',(monday + time '07:30') at time zone tz - interval '5 hours'),
    ('Alex','Mockwood','214-555-0193','alex.lead@example.com','physical','voice','contact_details',(monday + time '07:30') at time zone tz - interval '26 hours');

  -- tasks
  insert into public.tasks (patient_id,kind,summary,contact_name,contact_phone,created_at)
  select id,'refill','Refill request for a regular prescription', first_name||' '||last_name, phone, (monday - 3 + time '16:10') at time zone tz
  from public.patients where phone='214-555-0110';
  insert into public.tasks (patient_id,kind,summary,contact_name,contact_phone,created_at)
  select id,'records','Wants records sent to a new specialist', first_name||' '||last_name, phone, (monday - 3 + time '17:45') at time zone tz
  from public.patients where phone='214-555-0114';

  -- recalls due this week
  insert into public.recalls (patient_id,visit_type_id,due_date)
  select p.id, v.id, monday + (row_number() over () - 1)::int
  from (select * from public.patients where not is_new and id <> maria order by phone limit 4 offset 20) p
  cross join (select id from public.visit_types where code='physical') v;
end;
$$;

revoke all on function public.seed_demo() from public, anon;
grant execute on function public.seed_demo() to authenticated, service_role;

select public.seed_demo();