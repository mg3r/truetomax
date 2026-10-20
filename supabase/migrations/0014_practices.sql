-- Practices: what you make and offer (DJing, pottery, cooking, baking, fermenting). They feed your projects.
-- The practices and project_practices tables already exist (0004); this adds the days you practiced.
create table if not exists public.practice_sessions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  practice_id uuid not null references public.practices on delete cascade,
  day date not null,
  primary key (practice_id, day)
);
alter table public.practice_sessions enable row level security;
create policy "own rows" on public.practice_sessions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
