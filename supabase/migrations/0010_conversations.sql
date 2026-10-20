-- Partner chat in separate conversations, kept in a sidebar. Existing messages become one conversation called "Earlier".

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "own rows" on public.conversations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.messages add column conversation_id uuid references public.conversations on delete cascade;
create index on public.messages (conversation_id, created_at);

insert into public.conversations (user_id, title, created_at, updated_at)
select user_id, 'Earlier', min(created_at), max(created_at) from public.messages group by user_id;

update public.messages m set conversation_id = c.id
from public.conversations c
where c.user_id = m.user_id and c.title = 'Earlier' and m.conversation_id is null;
