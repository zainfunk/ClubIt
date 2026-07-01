-- 0015: Per-channel membership.
-- Every channel (including the seeded "General") has an explicit member list
-- controlled by the club's advisor/admins. Only members see a channel and its
-- messages. Existing members are backfilled so nobody loses access on deploy.

create table if not exists chat_channel_members (
  channel_id text not null references chat_channels(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  added_by   text references users(id),
  added_at   text not null,
  primary key (channel_id, user_id)
);

create index if not exists chat_channel_members_user_idx on chat_channel_members (user_id);
create index if not exists chat_channel_members_channel_idx on chat_channel_members (channel_id);

alter table chat_channel_members enable row level security;
-- All API routes use the service-role client which bypasses RLS.
create policy "deny_direct" on chat_channel_members for all using (false);

-- Backfill 1: seed every existing channel with its club's current members.
insert into chat_channel_members (channel_id, user_id, added_by, added_at)
select
  ch.id,
  m.user_id,
  c.advisor_id,
  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
from chat_channels ch
join clubs c on c.id = ch.club_id
join memberships m on m.club_id = ch.club_id
on conflict do nothing;

-- Backfill 2: make sure each club's advisor is a member of every channel.
insert into chat_channel_members (channel_id, user_id, added_by, added_at)
select
  ch.id,
  c.advisor_id,
  c.advisor_id,
  to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
from chat_channels ch
join clubs c on c.id = ch.club_id
where c.advisor_id is not null
on conflict do nothing;
