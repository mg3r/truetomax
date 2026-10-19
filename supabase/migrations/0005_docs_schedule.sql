-- Vision as one running doc you can reorder; a flexible schedule; your own docs as context for the partner.

alter table public.visions add column sort int not null default 0;

-- Morning, afternoon or evening; a time is optional.
alter table public.rhythm add column part_of_day text check (part_of_day in ('morning','afternoon','evening'));
alter table public.tasks add column part_of_day text check (part_of_day in ('morning','afternoon','evening'));

-- Docs you upload or link from Google Docs. The partner reads them for context.
create table public.context_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  source text not null default 'upload' check (source in ('upload','gdoc')),
  gdoc_id text,
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.context_docs enable row level security;
create policy "own rows" on public.context_docs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
