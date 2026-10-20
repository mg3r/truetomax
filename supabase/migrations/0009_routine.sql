-- Routine: what you do every day, every night, or on certain days of the week, and which days you did it.

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  cadence text not null check (cadence in ('daily', 'nightly', 'weekly')),
  weekdays int[] not null default '{}',
  sort int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.routines enable row level security;
create policy "own rows" on public.routines for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.routine_checks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  routine_id uuid not null references public.routines on delete cascade,
  day date not null,
  primary key (routine_id, day)
);
alter table public.routine_checks enable row level security;
create policy "own rows" on public.routine_checks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
