-- The words on truetomax.com (home title and intro, each section's title and description, the contact line), edited from Portfolio.
create table if not exists public.site_text (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  content jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_text enable row level security;
drop policy if exists "own rows" on public.site_text;
create policy "own rows" on public.site_text for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "public reads site text" on public.site_text;
create policy "public reads site text" on public.site_text for select to anon, authenticated using (true);
