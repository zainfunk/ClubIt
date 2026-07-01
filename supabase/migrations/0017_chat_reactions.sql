-- 0017: Emoji reactions on chat messages. One row per (message, user, emoji);
-- a user can react with several different emoji but not the same one twice.

create table if not exists chat_message_reactions (
  message_id text not null references chat_messages(id) on delete cascade,
  user_id    text not null references users(id) on delete cascade,
  emoji      text not null,
  created_at text not null,
  primary key (message_id, user_id, emoji)
);

create index if not exists chat_message_reactions_message_idx on chat_message_reactions (message_id);

alter table chat_message_reactions enable row level security;
-- All API routes use the service-role client which bypasses RLS.
create policy "deny_direct" on chat_message_reactions for all using (false);
