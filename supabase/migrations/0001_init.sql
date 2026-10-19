-- truetomax schema. Single-user app; every row is scoped to the signed-in user by RLS.

create extension if not exists "pgcrypto";

-- Who you are, in your words (about_me) and the partner's evolving read of you (summary).
create table public.profile_context (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  about_me text not null default '',
  summary text not null default '',
  summary_updated_at timestamptz,
  seeded boolean not null default false,
  created_at timestamptz not null default now()
);

-- Passages you add from your own copy of The Creative Act (or any book).
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  text text not null,
  source text not null default 'The Creative Act',
  location text,          -- chapter / page
  note text,
  times_shown int not null default 0,
  last_shown date,
  created_at timestamptz not null default now()
);

create table public.visions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  body text not null default '',
  horizon text not null default '1 year',  -- 3 months / 1 year / 5 years / lifetime
  status text not null default 'active' check (status in ('active','realized','released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  vision_id uuid references public.visions on delete set null,
  title text not null,
  description text not null default '',
  area text not null default 'other',
  status text not null default 'active' check (status in ('active','paused','eliminated','done')),
  status_note text,       -- why it was paused / eliminated
  makes_money boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  title text not null,
  metric text,            -- e.g. "paid dinners / month"
  target numeric,
  current numeric not null default 0,
  due_date date,
  status text not null default 'active' check (status in ('active','achieved','dropped')),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete set null,
  goal_id uuid references public.goals on delete set null,
  title text not null,
  notes text,
  day date,               -- the day it's planned for; null = backlog
  status text not null default 'todo' check (status in ('suggested','todo','done','skipped')),
  source text not null default 'me' check (source in ('me','rhythm','partner')),
  reason text,            -- why the partner suggested it
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Your weekly rhythm: recurring tasks by weekday (0 = Sunday ... 6 = Saturday).
create table public.rhythm (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  title text not null,
  project_id uuid references public.projects on delete set null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- One row per day: what the partner prepared for you.
create table public.days (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null,
  affirmation text,
  highlight_id uuid references public.highlights on delete set null,
  question text,
  focus text,             -- one sentence: the one thing that matters today
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  day date not null default current_date,
  prompt text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ideas the partner surfaces (or you add): ventures, offers, content.
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null default 'venture' check (kind in ('venture','content')),
  title text not null,
  body text not null default '',
  first_step text,
  money_path text,
  status text not null default 'new' check (status in ('new','exploring','planned','eliminated')),
  status_note text,
  source text not null default 'partner' check (source in ('me','partner')),
  project_id uuid references public.projects on delete set null,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  kind text not null default 'chat' check (kind in ('chat','focus_review')),
  created_at timestamptz not null default now()
);

create index on public.tasks (user_id, day);
create index on public.journal_entries (user_id, day desc);
create index on public.messages (user_id, created_at desc);

-- Row level security: you only ever see your own rows.
do $$
declare t text;
begin
  foreach t in array array['profile_context','highlights','visions','projects','goals','tasks','rhythm','days','journal_entries','ideas','messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
