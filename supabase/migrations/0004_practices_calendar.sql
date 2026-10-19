-- Practices: the aligned actions you do again and again (DJing, cooking, pottery, art, hosting).
-- They feed projects (a cacao brand, a dinner concept), and projects serve visions.

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  description text not null default '',
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.project_practices (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  practice_id uuid not null references public.practices on delete cascade,
  primary key (project_id, practice_id)
);

alter table public.rhythm
  add column practice_id uuid references public.practices on delete set null,
  add column at_time time;          -- optional time of day, so Today can order your routine

alter table public.tasks
  add column practice_id uuid references public.practices on delete set null;

-- Google Calendar connection (read-only). Only the refresh token is kept; access tokens are short-lived.
create table public.google_accounts (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  email text,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['practices','project_practices','google_accounts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Routine items carry their time and practice onto the day's tasks.
alter table public.tasks
  add column at_time time;
