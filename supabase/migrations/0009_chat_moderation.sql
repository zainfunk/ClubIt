-- 0009 — Chat moderation for user-generated content (App Store Guideline 1.2).
--
-- Apple requires apps with UGC to provide: a content filter, a way to report
-- objectionable content, a way to block abusive users, and a path for the
-- operator to act on reports. This migration adds the storage for reports and
-- blocks. Content filtering happens in app code (lib/content-filter.ts).
--
-- Both tables are accessed only through service-role API routes, so RLS is
-- enabled with NO permissive policy = deny-all for anon/authenticated clients.

-- Reports of individual chat messages.
create table if not exists chat_message_reports (
  id text primary key,
  message_id text references chat_messages(id) on delete cascade,
  reporter_id text references users(id) on delete set null,
  school_id uuid references schools(id) on delete cascade,
  reason text,
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists chat_message_reports_school_status_idx
  on chat_message_reports (school_id, status);

-- User-to-user blocks. blocker stops seeing blocked's messages.
create table if not exists user_blocks (
  blocker_id text references users(id) on delete cascade,
  blocked_id text references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create index if not exists user_blocks_blocker_idx on user_blocks (blocker_id);

alter table chat_message_reports enable row level security;
alter table user_blocks enable row level security;
