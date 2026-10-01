CREATE OR REPLACE FUNCTION public.seed_demo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  sam uuid; maria uuid; priya uuid; ben uuid;
begin
  perform setseed(0.42);
  truncate public.automation_runs, public.messages, public.tasks, public.recalls, public.leads,
    public.waitlist, public.intake_forms, public.appointments, public.patients,
    public.schedule_blocks, public.visit_types, public.clinic_settings restart identity cascade;

  monday := date '2026-10-05';

  insert into public.clinic_settings (id, hours, accepted_insurers, self_pay, demo_now) values (1,
    '{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","15:00"],"lunch":["12:00","13:00"],"wed_telehealth_only":["13:00","17:00"],"sick_hold":["08:00","09:00"]}',
    array['Aetna','Blue Cross Blue Shield of Texas','UnitedHealthcare','Cigna','Medicare','Self-pay'],
    '{"new":150,"follow_up":95}',
    (monday + time '07:30') at time zone tz);

  insert into public.visit_types (code,name,minutes,modes,latest_start,max_per_day,new_only,established_only,insurer_only,sort) values
    ('new_patient','New patient visit',60,'{in_person}','15:00',2,true,false,null,1),
    ('physical','Annual physical',40,'{in_person}','11:00',null,false,false,null,2),
    ('medicare_awv','Medicare Annual Wellness',40,'{in_person}','11:30',null,false,false,'Medicare',3),
    ('follow_up','Chronic care follow-up',20,'{in_person,telehealth}',null,null,false,true,null,4),
    ('sick','Sick visit (same-day)',15,'{in_person}','09:15',null,false,false,null,5),
    ('telehealth','Telehealth quick visit',15,'{telehealth}',null,null,false,true,null,6);

  d := least(today, monday); n := 0;
  while n < 21 loop
    if extract(isodow from d) between 1 and 5 then
      insert into public.schedule_blocks (kind,start_at,end_at,note) values
        ('sick_hold',(d + time '08:00') at time zone tz,(d + time '09:00') at time zone tz,'Same-day sick visits'),
        ('lunch',(d + time '12:00') at time zone tz,(d + time '13:00') at time zone tz,'Lunch');
      if extract(isodow from d) = 3 then
        insert into public.schedule_blocks (kind,start_at,end_at,note) values
          ('telehealth_only',(d + time '13:00') at time zone tz,(d + time '17:00') at time zone tz,'Telehealth only');
      end if;
      n := n + 1;
    end if;
    d := d + 1;
  end loop;

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
  update public.patients set first_name='Sam', last_name='Lee', is_new=true, insurer='Aetna', email='sam.lee@example.com', no_show_count=0
    where phone='214-555-0101' returning id into sam;
  update public.patients set first_name='Maria', last_name='Gomez', is_new=false, insurer='Blue Cross Blue Shield of Texas', email='maria.gomez@example.com'
    where phone='214-555-0102' returning id into maria;
  update public.patients set first_name='Priya', last_name='Nair', is_new=true, insurer='Cigna', email='priya.nair@example.com'
    where phone='214-555-0103' returning id into priya;
  insert into public.patients (first_name,last_name,dob,phone,email,insurer,is_new,no_show_count)
    values ('Ben','Ortiz',date '1971-06-14','214-555-0141','ben.ortiz@example.com','UnitedHealthcare',false,0) returning id into ben;

  insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status)
  select sam, id, (monday + 2 + time '10:00') at time zone tz, (monday + 2 + time '11:00') at time zone tz, 'in_person','confirmed','new_patient','form','not_started'
  from public.visit_types where code='new_patient';
  insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status)
  select maria, id, (monday + 1 + time '14:00') at time zone tz, (monday + 1 + time '14:20') at time zone tz, 'in_person','reconfirmed','follow_up','chat','done'
  from public.visit_types where code='follow_up';
  update public.appointments set reconfirmed_at = (monday - 1 + time '18:00') at time zone tz where patient_id = maria;

  d := monday; n := 0;
  while n < 14 loop
    if extract(isodow from d) between 1 and 5 then
      close_m := case when extract(isodow from d) = 5 then 15*60 else 17*60 end;
      m := 9*60;
      while m < close_m loop
        if m >= 12*60 and m < 13*60 then m := 13*60; continue; end if;
        if d between monday + 1 and monday + 3 and m >= 9*60 and m < 10*60 then m := 10*60; continue; end if;
        if random() < 0.62 then
          r := random();
          vmode := 'in_person';
          if extract(isodow from d) = 3 and m >= 13*60 then
            vcode := case when r < 0.5 then 'telehealth' else 'follow_up' end; vmode := 'telehealth';
          elsif m <= 11*60 and r < 0.25 then vcode := 'physical';
          elsif m <= 11*60 + 30 and r < 0.35 then vcode := 'medicare_awv';
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
            select id into pid from public.patients where not is_new and id not in (maria, ben) order by random() limit 1;
          end if;
          perform random(); st := 'reconfirmed';
          perform random();
          insert into public.appointments (patient_id,visit_type_id,start_at,end_at,mode,status,reason_category,source,intake_status,reconfirmed_at)
          values (pid, vt.id, s, e, vmode, st,
            (case vcode when 'new_patient' then 'new_patient' when 'physical' then 'physical' when 'medicare_awv' then 'physical'
              when 'telehealth' then 'telehealth' else 'follow_up' end)::public.reason_category,
            (array['form','chat','voice','staff'])[1 + floor(random()*4)::int]::public.appt_source,
            'done',
            (monday + time '07:00') at time zone tz);
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

  insert into public.waitlist (patient_id,visit_type_codes,earliest_date,latest_date,"window",status,created_at)
    values (priya, '{new_patient}', monday, monday + 4, 'any', 'waiting', (monday - 3 + time '09:00') at time zone tz),
           (ben, '{follow_up}', monday, monday + 4, 'any', 'waiting', (monday - 3 + time '09:30') at time zone tz);
  insert into public.waitlist (patient_id,visit_type_codes,earliest_date,latest_date,"window",status,created_at)
  select p.id,
    case when p.is_new then '{new_patient}'::text[] else '{follow_up}'::text[] end,
    monday + 7, monday + 14,
    (array['am','pm','any'])[1 + (row_number() over () % 3)::int]::public.waitlist_window,
    'waiting',
    (monday - 2 + time '09:00') at time zone tz + (row_number() over ()) * interval '1 hour'
  from (select * from public.patients where id not in (sam, maria, priya, ben) order by phone limit 6 offset 10) p;

  insert into public.leads (first_name,last_name,phone,email,reason_category,source,step_reached,last_activity_at,created_at) values
    ('Jamie','Placeholder','214-555-0191','jamie.lead@example.com','sick','form','safety_check',(monday + time '06:45') at time zone tz,(monday + time '06:45') at time zone tz);

  insert into public.tasks (patient_id,kind,summary,contact_name,contact_phone,created_at) values
    (null,'refill','Refill request for a regular prescription','Linda Park','214-555-0187',(monday - 3 + time '16:10') at time zone tz),
    (null,'records','Wants records sent to a new specialist','Omar Haddad','214-555-0188',(monday - 3 + time '17:45') at time zone tz);

  insert into public.automation_runs (rule,actions_count,minutes_saved,run_at,details)
  select h.rule, 1, h.mins,
    ((monday - 7 + (g % 7)) + time '08:00' + ((g * 37) % 540) * interval '1 minute') at time zone tz,
    jsonb_build_object('history', true)
  from (values ('self_service_booking',6,40),('instant_confirmation',2,60),('intake_chaser',3,50),
               ('confirm_or_release',3,45),('waitlist_refill',10,6),('lead_nudge',4,15),('recall',5,10),('task_routing',4,20))
       as h(rule,mins,cnt)
  cross join lateral generate_series(1, h.cnt) g;

  insert into public.recalls (patient_id,visit_type_id,due_date,status,last_contacted_at)
  select p.id, v.id, monday + (row_number() over () - 1)::int, 'contacted', (monday - 3 + time '10:00') at time zone tz
  from (select * from public.patients where not is_new and id <> maria order by phone limit 4 offset 20) p
  cross join (select id from public.visit_types where code='physical') v;
end;
$function$;

REVOKE ALL ON FUNCTION public.seed_demo() FROM PUBLIC, anon, authenticated;

SELECT public.seed_demo();