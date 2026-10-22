-- Your public portfolio at truetomax.com: photos you upload, order and describe yourself.
-- One table for every kind of work (pottery now; DJing, food, art and truetoyou later), by section.
create table if not exists public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  section text not null default 'pottery',
  image_path text not null,
  title text,
  description text,
  width int,
  height int,
  sort double precision not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_items_section_sort on public.portfolio_items (section, sort);

alter table public.portfolio_items enable row level security;
drop policy if exists "own rows" on public.portfolio_items;
create policy "own rows" on public.portfolio_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Anyone can see what you've published: that's the point of a portfolio.
drop policy if exists "public reads published" on public.portfolio_items;
create policy "public reads published" on public.portfolio_items for select to anon, authenticated using (published);

-- The photos themselves: a public bucket anyone can view; only you can add, change or remove.
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true) on conflict (id) do update set public = true;
drop policy if exists "portfolio public read" on storage.objects;
create policy "portfolio public read" on storage.objects for select using (bucket_id = 'portfolio');
drop policy if exists "portfolio owner insert" on storage.objects;
create policy "portfolio owner insert" on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and owner = auth.uid());
drop policy if exists "portfolio owner update" on storage.objects;
create policy "portfolio owner update" on storage.objects for update to authenticated using (bucket_id = 'portfolio' and owner = auth.uid());
drop policy if exists "portfolio owner delete" on storage.objects;
create policy "portfolio owner delete" on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and owner = auth.uid());
