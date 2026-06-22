-- 0012 — Event reminder bookkeeping (App Store Guideline 4.2 native push).
--
-- Adds a per-event tombstone so the /api/cron/event-reminders job can send a
-- "happening soon" APNs push exactly once per event. The partial index keeps the
-- "due but not yet reminded" scan cheap as the events table grows.
--
-- events.date is ISO-8601 text (sortable), so the cron compares it lexically
-- against now / now+24h. Like the push table (0010) this is dormant until the
-- APNs key is set — the column is harmless to apply ahead of time.

alter table events add column if not exists reminder_sent_at timestamptz;

create index if not exists idx_events_reminder_due
  on events (date)
  where reminder_sent_at is null;
