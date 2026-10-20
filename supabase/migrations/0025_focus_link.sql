-- The focus line can point to the action it's about, so tapping it takes you there.
alter table public.days add column if not exists focus_task_id uuid references public.tasks(id) on delete set null;
