-- When the partner offers an Up next task from a project as one of today's suggestions, the suggestion remembers where it came from,
-- so accepting it moves that task to today instead of making a copy.
alter table public.tasks add column if not exists origin_task_id uuid references public.tasks on delete set null;

-- Up next no longer means "tomorrow": undated Up next tasks wait in their project until you give them a day.
