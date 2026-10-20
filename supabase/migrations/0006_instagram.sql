-- Instagram (truetomax): read-only posts and insights, so the partner learns what lands.

create table public.instagram_accounts (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  ig_user_id text not null,
  username text,
  access_token text not null,
  expires_at timestamptz,
  followers int,
  connected_at timestamptz not null default now(),
  synced_at timestamptz
);

create table public.instagram_media (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  media_id text not null,
  caption text,
  media_type text,
  product_type text,          -- FEED, REELS, STORY
  permalink text,
  posted_at timestamptz,
  likes int,
  comments int,
  reach int,
  saves int,
  shares int,
  views int,
  synced_at timestamptz not null default now(),
  primary key (user_id, media_id)
);

do $$
declare t text;
begin
  foreach t in array array['instagram_accounts','instagram_media']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
