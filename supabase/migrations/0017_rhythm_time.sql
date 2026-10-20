-- Rhythm items can have a part of day and an optional time, so they sit in the right place on Schedule and Today.
alter table public.routines add column if not exists part_of_day text check (part_of_day in ('morning', 'afternoon', 'evening'));
alter table public.routines add column if not exists at_time time;
