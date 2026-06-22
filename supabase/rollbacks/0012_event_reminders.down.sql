-- Down migration for 0012_event_reminders.sql
drop index if exists idx_events_reminder_due;
alter table events drop column if exists reminder_sent_at;
