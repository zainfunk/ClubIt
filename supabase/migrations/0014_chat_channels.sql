-- 0014: Multiple named channels per club.
-- Advisors and admins can create channels; all members can post.

create table if not exists chat_channels (
  id         text primary key,
  club_id    text not null references clubs(id) on delete cascade,
  name       text not null,
  created_by text references users(id),
  created_at text not null
);

alter table chat_channels enable row level security;
-- All API routes use the service-role client which bypasses RLS.
create policy "deny_direct" on chat_channels for all using (false);

-- Seed a "General" channel for every existing club.
insert into chat_channels (id, club_id, name, created_by, created_at)
select
  'chan-general-' || id,
  id,
  'General',
  advisor_id,
  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
from clubs
on conflict (id) do nothing;

-- Attach existing messages to their club's General channel.
alter table chat_messages add column if not exists channel_id text references chat_channels(id) on delete cascade;

update chat_messages
set channel_id = 'chan-general-' || club_id
where channel_id is null;
