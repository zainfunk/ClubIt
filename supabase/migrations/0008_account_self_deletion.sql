-- 0008 — Self-service account deletion (App Store Guideline 5.1.1(v)).
--
-- Apple requires any app that supports account creation to also let the user
-- delete their account from inside the app. ClubIt cannot hard-DELETE a users
-- row because many tables (chat_messages.sender_id, election_votes.voter_user_id,
-- poll_votes, events.created_by, ...) reference users(id) with the default
-- ON DELETE NO ACTION (RESTRICT), and the secret-ballot design depends on those
-- vote rows staying intact. So deletion = remove the Clerk identity + cascade
-- the user's personal rows + scrub the users row to an anonymized tombstone.
--
-- This column marks tombstoned accounts so the rest of the app can exclude them
-- from rosters, leaderboards, and re-sync.

alter table users add column if not exists deleted_at timestamptz;

-- Partial index: fast "is this account live?" checks and roster filtering.
create index if not exists users_deleted_at_idx on users (deleted_at)
  where deleted_at is not null;
