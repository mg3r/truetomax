-- Vision becomes one page you write freely (with titles, bullets and numbered lists), like a simple doc.
create table if not exists public.vision_doc (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  html text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.vision_doc enable row level security;
drop policy if exists "own rows" on public.vision_doc;
create policy "own rows" on public.vision_doc for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- What you'd already written carries over: each vision becomes a title with its text below.
insert into public.vision_doc (user_id, html)
select v.user_id,
  string_agg(
    '<h2>' || replace(replace(replace(v.title, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</h2>' ||
    coalesce((select string_agg('<p>' || replace(replace(replace(line, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>', '')
              from unnest(string_to_array(nullif(v.body, ''), E'\n')) as line where trim(line) <> ''), ''),
    '' order by v.sort, v.created_at)
from public.visions v
where v.status <> 'released'
group by v.user_id
on conflict (user_id) do nothing;
