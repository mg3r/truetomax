-- Action ideas on the Actions page, alongside project ideas and post ideas.
alter table public.ideas drop constraint if exists ideas_kind_check;
alter table public.ideas add constraint ideas_kind_check check (kind in ('venture', 'content', 'action'));
