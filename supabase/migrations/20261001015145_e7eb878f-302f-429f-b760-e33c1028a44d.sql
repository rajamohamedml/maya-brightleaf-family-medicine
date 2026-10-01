DO $mig$
DECLARE src text; n int;
BEGIN
  src := pg_get_functiondef('public.seed_demo()'::regprocedure);
  n := length(src);
  src := replace(src, '"sick_hold":["08:00","09:30"]', '"sick_hold":["08:00","09:00"]');
  src := replace(src, $r$('sick_hold',(d + time '08:00') at time zone tz,(d + time '09:30') at time zone tz$r$, $r$('sick_hold',(d + time '08:00') at time zone tz,(d + time '09:00') at time zone tz$r$);
  src := replace(src, $r$('physical','Annual physical',40,'{in_person}','10:00'$r$, $r$('physical','Annual physical',40,'{in_person}','11:00'$r$);
  src := replace(src, $r$('medicare_awv','Medicare Annual Wellness',40,'{in_person}','11:00'$r$, $r$('medicare_awv','Medicare Annual Wellness',40,'{in_person}','11:30'$r$);
  src := replace(src, 'm := 9*60 + 30;', 'm := 9*60;');
  src := replace(src, $r$elsif m <= 10*60 and r < 0.25 then vcode := 'physical';$r$, $r$elsif m <= 11*60 and r < 0.25 then vcode := 'physical';$r$);
  src := replace(src, $r$elsif m <= 11*60 and r < 0.35 then vcode := 'medicare_awv';$r$, $r$elsif m <= 11*60 + 30 and r < 0.35 then vcode := 'medicare_awv';$r$);
  src := replace(src, 'if m >= 12*60 and m < 13*60 then m := 13*60; continue; end if;',
    'if m >= 12*60 and m < 13*60 then m := 13*60; continue; end if;
        -- keep demo-week Tue-Thu 9-10am open for annual physicals
        if d between monday + 1 and monday + 3 and m >= 9*60 and m < 10*60 then m := 10*60; continue; end if;');
  IF position('09:30' in src) > 0 OR position('9*60 + 30' in src) > 0 OR position('monday + 3 and m' in src) = 0 THEN
    RAISE EXCEPTION 'seed_demo patch did not apply cleanly';
  END IF;
  EXECUTE src;
END
$mig$;
SELECT public.seed_demo();