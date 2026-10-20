-- Simplify: things that repeat live only in Rhythm, and work-and-income ideas become Backlog projects.
-- Run after 0016 and 0017.

-- 1. Schedule's "every week" items move into Rhythm, keeping their days and time.
--    A scheduled practice updates that practice's days; everything else becomes a weekly ritual on those days.
update public.routines r
set weekdays = x.days, times_per_week = greatest(1, least(7, array_length(x.days, 1))), part_of_day = coalesce(r.part_of_day, x.part), at_time = coalesce(r.at_time, x.at)
from (
  select routine_id, array_agg(distinct weekday order by weekday) as days, max(part_of_day) as part, max(at_time) as at
  from public.rhythm where routine_id is not null group by routine_id
) x
where r.id = x.routine_id and r.cadence = 'weekly';

insert into public.routines (user_id, title, cadence, weekdays, times_per_week, kind, part_of_day, at_time, sort)
select user_id, title, 'weekly', array_agg(distinct weekday order by weekday), greatest(1, least(7, count(distinct weekday)::int)), 'ritual', max(part_of_day), max(at_time), 500
from public.rhythm
where routine_id is null
group by user_id, title;

delete from public.rhythm;

-- 2. Open work-and-income ideas become Backlog projects (status "paused" is shown as Backlog).
insert into public.projects (user_id, title, description, status, makes_money)
select user_id, title,
  concat_ws(E'\n\n', nullif(body, ''), case when money_path is not null then 'Money path: ' || money_path end, case when first_step is not null then 'First step: ' || first_step end),
  'paused', money_path is not null
from public.ideas
where kind = 'venture' and status in ('new', 'exploring');

update public.ideas set status = 'planned' where kind = 'venture' and status in ('new', 'exploring');
