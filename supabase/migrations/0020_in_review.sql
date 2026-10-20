-- Projects can be "In review": ideas suggested by your partner (or added by you) that you haven't accepted yet.
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check check (status in ('review', 'active', 'paused', 'eliminated', 'done'));

-- Ideas the partner suggested earlier that landed in the Backlog move to In review.
update public.projects p set status = 'review'
where p.status = 'paused' and exists (select 1 from public.ideas i where i.project_id = p.id);
