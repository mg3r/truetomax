-- An action can belong to more than one project and count toward more than one practice.
-- project_id / routine_id stay as the first one, so older code keeps working.
alter table tasks add column if not exists project_ids uuid[] not null default '{}';
alter table tasks add column if not exists routine_ids uuid[] not null default '{}';
update tasks set project_ids = array[project_id] where project_id is not null and project_ids = '{}';
update tasks set routine_ids = array[routine_id] where routine_id is not null and routine_ids = '{}';
create index if not exists tasks_project_ids_idx on tasks using gin (project_ids);
create index if not exists tasks_routine_ids_idx on tasks using gin (routine_ids);
