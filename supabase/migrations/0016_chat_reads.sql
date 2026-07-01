-- 0016: Per-user chat read state, one row per (user, club). Drives the unread
-- red badges on the chat list and the bottom-nav Chat tab. A club is "read" up
-- to last_read_at; anything newer from someone else counts as unread.

create table if not exists chat_reads (
  user_id      text not null references users(id) on delete cascade,
  club_id      text not null references clubs(id) on delete cascade,
  last_read_at text not null,
  primary key (user_id, club_id)
);

alter table chat_reads enable row level security;
-- All API routes use the service-role client which bypasses RLS.
create policy "deny_direct" on chat_reads for all using (false);
