-- Moves are noticed for you: from actions you finish, what you write in your journal, and what you tell your partner.
-- Each move remembers where it came from, so editing or deleting the source updates it.
alter table public.moves add column if not exists source text;      -- action / journal / chat / instagram / me
alter table public.moves add column if not exists source_id uuid;
create index if not exists moves_source_idx on public.moves (source, source_id);
