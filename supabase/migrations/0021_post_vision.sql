-- What's actually in each Instagram post, as your partner sees it (from the photos, or a reel's cover).
alter table public.instagram_media add column if not exists seen text;
alter table public.instagram_media add column if not exists seen_at timestamptz;
