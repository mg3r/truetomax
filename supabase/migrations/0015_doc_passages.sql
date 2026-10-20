-- Long docs are kept in memory as many passages, not one, so the partner can find the right part of any doc.
alter table public.memory add column if not exists part int not null default 0;
alter table public.memory drop constraint if exists memory_user_id_source_type_source_id_key;
alter table public.memory add constraint memory_source_part_key unique (user_id, source_type, source_id, part);

-- The passages of your docs that best match a question, by meaning (or by words until meaning is available).
create or replace function public.match_docs(query_text text, query_embedding vector(384) default null, match_count int default 6)
returns table (content text, score real)
language sql stable security invoker as $$
  with q as (
    select nullif(replace(plainto_tsquery('english', coalesce(query_text, ''))::text, '&', '|'), '')::tsquery as tsq
  )
  select m.content,
    case when query_embedding is not null and m.embedding is not null
      then (1 - (m.embedding <=> query_embedding))::real
      else ts_rank(m.fts, q.tsq)::real
    end as score
  from public.memory m, q
  where m.source_type = 'doc'
    and ((query_embedding is not null and m.embedding is not null) or (q.tsq is not null and m.fts @@ q.tsq))
  order by score desc
  limit match_count;
$$;

-- General recall (journal, tasks, chats…) leaves doc passages to match_docs, so long docs don't crowd out your own history.
create or replace function public.match_memory(query_text text, query_embedding vector(384) default null, match_count int default 8, before_day date default null)
returns table (source_type text, day date, content text, score real)
language sql stable security invoker as $$
  with q as (
    select nullif(replace(plainto_tsquery('english', coalesce(query_text, ''))::text, '&', '|'), '')::tsquery as tsq
  )
  select m.source_type, m.day, m.content,
    case when query_embedding is not null and m.embedding is not null
      then (1 - (m.embedding <=> query_embedding))::real
      else ts_rank(m.fts, q.tsq)::real
    end as score
  from public.memory m, q
  where m.source_type <> 'doc'
    and (before_day is null or m.day < before_day)
    and (
      (query_embedding is not null and m.embedding is not null)
      or (q.tsq is not null and m.fts @@ q.tsq)
    )
  order by score desc
  limit match_count;
$$;
