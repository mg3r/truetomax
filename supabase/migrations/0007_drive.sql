-- Google Drive folders: every doc inside becomes context for the partner, kept in sync.

create table public.drive_folders (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  folder_id text not null,
  name text,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, folder_id)
);
alter table public.drive_folders enable row level security;
create policy "own rows" on public.drive_folders for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.context_docs drop constraint if exists context_docs_source_check;
alter table public.context_docs add constraint context_docs_source_check check (source in ('upload','gdoc','gdrive'));
alter table public.context_docs
  add column folder_id text,
  add column modified_at timestamptz;
