-- Every piece gets a catalogue number (No. 07) when it's uploaded, and keeps it however you reorder.
alter table public.portfolio_items add column if not exists number int;
update public.portfolio_items p set number = n.rn
from (select id, row_number() over (partition by user_id, section order by created_at, id) as rn from public.portfolio_items) n
where p.id = n.id and p.number is null;
create unique index if not exists portfolio_items_number on public.portfolio_items (user_id, section, number);
