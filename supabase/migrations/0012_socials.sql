-- Socials: the partner's read on what's working across your pages, with recommendations. Instagram first; more platforms later.
create table public.social_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  platform text not null default 'instagram',
  body jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.social_insights enable row level security;
create policy "own rows" on public.social_insights for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- A small picture for each post (Instagram's link refreshes with each sync).
alter table public.instagram_media add column if not exists thumb_url text;
