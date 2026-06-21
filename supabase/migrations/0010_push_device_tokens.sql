-- 0010 — Push notification device tokens (App Store Guideline 4.2 native signal).
--
-- Stores one row per (user, device push token) so a server route can deliver
-- APNs pushes for chat mentions, event reminders, and election openings. This
-- is a genuine native capability that strengthens the case that ClubIt is a
-- real app and not a wrapped website.
--
-- Accessed only through service-role API routes (/api/push/*), so RLS is
-- enabled with NO permissive policy = deny-all for anon/authenticated clients.

create table if not exists device_push_tokens (
  token text primary key,
  user_id text references users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx on device_push_tokens (user_id);

alter table device_push_tokens enable row level security;
