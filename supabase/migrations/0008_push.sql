-- Morning notification: the devices that receive it, and the app's own signing keys.

create table public.push_subscriptions (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own rows" on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- The app's push keys. Row level security is on with no policies, so only the server (service role) can read it.
create table public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
