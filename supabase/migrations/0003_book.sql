-- Your own copy of The Creative Act (or any book), stored privately page by page.
-- Each morning truetomax opens to a page you haven't seen in a while.

create table public.book_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book text not null default 'The Creative Act',
  page int not null,
  text text not null,
  times_shown int not null default 0,
  last_shown date,
  created_at timestamptz not null default now(),
  unique (user_id, book, page)
);

alter table public.book_pages enable row level security;
create policy "own rows" on public.book_pages for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.days
  add column page_id uuid references public.book_pages on delete set null,
  add column past_questions text[] not null default '{}';
