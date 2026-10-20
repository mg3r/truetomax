-- More of what Instagram's own insights show, per post and for the account.
alter table public.instagram_media add column if not exists interactions int;
alter table public.instagram_media add column if not exists reposts int;
alter table public.instagram_media add column if not exists follows int;
alter table public.instagram_media add column if not exists profile_visits int;
alter table public.instagram_media add column if not exists avg_watch_ms int;
alter table public.instagram_media add column if not exists watch_ms bigint;
alter table public.instagram_media add column if not exists skip_rate numeric;
alter table public.instagram_media add column if not exists duration_s numeric;
-- What the partner saw, in full: slide by slide or moment by moment.
alter table public.instagram_media add column if not exists seen_detail jsonb;
-- Account totals for the last 30 days (followers vs non-followers, by format, follows and unfollows).
alter table public.instagram_accounts add column if not exists stats jsonb;
-- Look again at carousels and videos: now every slide, and frames from across each video.
update public.instagram_media set seen = null, seen_at = null where media_type in ('CAROUSEL_ALBUM', 'VIDEO') or product_type = 'REELS';
