-- Weekly routine items are about how often, not which day: "2× a week". Pinning to days stays optional.
alter table public.routines add column times_per_week int not null default 1 check (times_per_week between 1 and 7);

-- Existing weekly items become a count: Tue + Thu → 2× a week, any day.
update public.routines
set times_per_week = greatest(1, least(7, coalesce(array_length(weekdays, 1), 1))), weekdays = '{}'
where cadence = 'weekly';
