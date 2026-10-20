-- Rhythm: rituals and practices in one list. Each item is a ritual (tends you) or a practice (what you make and offer).
-- Practices you added on the old Practices tab move in as weekly practices, with their project links, logged days and actions.
-- Run after 0009, 0011 and 0014.

alter table public.routines add column if not exists kind text not null default 'ritual' check (kind in ('ritual', 'practice'));
alter table public.routines add column if not exists legacy_practice_id uuid;

create table if not exists public.routine_projects (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  primary key (routine_id, project_id)
);
alter table public.routine_projects enable row level security;
drop policy if exists "own rows" on public.routine_projects;
create policy "own rows" on public.routine_projects for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.tasks add column if not exists routine_id uuid references public.routines on delete set null;
alter table public.rhythm add column if not exists routine_id uuid references public.routines on delete set null;

-- Move the old practices in.
insert into public.routines (user_id, title, cadence, weekdays, times_per_week, kind, sort, legacy_practice_id)
select p.user_id, p.name, 'weekly', '{}', 1, 'practice', 1000 + p.sort, p.id
from public.practices p
where not exists (select 1 from public.routines r where r.legacy_practice_id = p.id);

insert into public.routine_projects (user_id, routine_id, project_id)
select pp.user_id, r.id, pp.project_id
from public.project_practices pp join public.routines r on r.legacy_practice_id = pp.practice_id
on conflict do nothing;

do $$
begin
  if to_regclass('public.practice_sessions') is not null then
    insert into public.routine_checks (user_id, routine_id, day)
    select s.user_id, r.id, s.day
    from public.practice_sessions s join public.routines r on r.legacy_practice_id = s.practice_id
    on conflict do nothing;
  end if;
end $$;

update public.tasks t set routine_id = r.id from public.routines r where r.legacy_practice_id = t.practice_id and t.routine_id is null;
update public.rhythm x set routine_id = r.id from public.routines r where r.legacy_practice_id = x.practice_id and x.routine_id is null;
