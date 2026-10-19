-- truetomax learning layer: the app changes what it does based on what you actually do.

create extension if not exists vector;

-- What the partner has learned, as specific, evidence-backed rules you can confirm or reject.
create table public.insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  statement text not null,          -- "Follows through on cooking tasks; skips posting on studio days"
  evidence text,                    -- what in the record supports it
  kind text not null default 'pattern' check (kind in ('pattern','strength','avoidance','preference','opportunity')),
  confidence numeric not null default 0.5 check (confidence between 0 and 1),
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected','retired')),
  your_note text,                   -- your correction, if any
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Moves: every time you share your work or ask someone to pay you. The number that matters.
create table public.moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('shared','asked','booked','sold')),
  note text,
  amount numeric,                   -- money in, for booked / sold
  project_id uuid references public.projects on delete set null,
  task_id uuid references public.tasks on delete set null,
  day date not null default current_date,
  created_at timestamptz not null default now()
);

-- Changes to your weekly rhythm the partner proposes from what you actually do.
create table public.rhythm_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  action text not null check (action in ('add','remove','move')),
  rhythm_id uuid references public.rhythm on delete set null,
  title text,
  weekday int check (weekday between 0 and 6),
  to_weekday int check (to_weekday between 0 and 6),
  reason text not null,
  status text not null default 'proposed' check (status in ('proposed','accepted','declined')),
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_of date not null,
  body text not null,
  stats jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);

-- Long-term memory: everything you write and do, searchable by meaning (embeddings) and by words (full text).
create table public.memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source_type text not null,        -- journal / task / vision / project / idea / move / chat
  source_id uuid not null,
  day date not null default current_date,
  content text not null,
  embedding vector(384),            -- gte-small; null until the embed function is deployed
  fts tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);
create index on public.memory using gin (fts);
create index on public.memory using hnsw (embedding vector_cosine_ops);

-- Tasks learn what kind of work they are, so the partner can see what you follow through on.
alter table public.tasks
  add column category text check (category in ('make','practice','share','ask','learn','admin','body','rest')),
  add column size text check (size in ('small','medium','large')),
  add column accepted_at timestamptz;

-- How the partner should behave, tuned each week from results.
alter table public.profile_context
  add column policy jsonb not null default '{}'::jsonb,
  add column last_learned_at timestamptz;

do $$
declare t text;
begin
  foreach t in array array['insights','moves','rhythm_proposals','reviews','memory']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Find the memories most relevant to a question. Uses meaning when an embedding is given, words otherwise.
-- security invoker: row level security still applies, so it only ever searches your own rows.
create or replace function public.match_memory(query_text text, query_embedding vector(384) default null, match_count int default 8, before_day date default null)
returns table (source_type text, day date, content text, score real)
language sql stable security invoker as $$
  -- Any word may match (OR), so a long question still finds relevant entries.
  with q as (
    select nullif(replace(plainto_tsquery('english', coalesce(query_text, ''))::text, '&', '|'), '')::tsquery as tsq
  )
  select m.source_type, m.day, m.content,
    case when query_embedding is not null and m.embedding is not null
      then (1 - (m.embedding <=> query_embedding))::real
      else ts_rank(m.fts, q.tsq)::real
    end as score
  from public.memory m, q
  where (before_day is null or m.day < before_day)
    and (
      (query_embedding is not null and m.embedding is not null)
      or (q.tsq is not null and m.fts @@ q.tsq)
    )
  order by score desc
  limit match_count;
$$;
