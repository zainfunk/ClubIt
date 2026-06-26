-- 0013_onboard_dedupe.sql
--
-- Fix #3 (onboard double-submit race): a rapid double-tap on /api/onboard could
-- create two pending schools for the same requester, orphaning the first one
-- forever (its requested_admin_user_id points at a user now linked to the other
-- school). The app now guards against this, but the guard isn't atomic — this
-- partial unique index is the race-proof backstop: at most ONE pending school
-- per requester.
--
-- Pre-clean any existing duplicate pending rows first so the index can be
-- created. Keep the most recently created pending school per requester and
-- delete the older duplicates (same treatment a superadmin "reject" gives a
-- pending school; the schools.status CHECK has no 'rejected' value, so we delete
-- rather than mark). Rows with a null requested_admin_user_id are left alone.

DELETE FROM schools s
USING (
  SELECT id,
    row_number() OVER (
      PARTITION BY requested_admin_user_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM schools
  WHERE status = 'pending'
    AND requested_admin_user_id IS NOT NULL
) ranked
WHERE s.id = ranked.id
  AND ranked.rn > 1;

-- One pending request per requester. Partial: only constrains pending rows, so a
-- user can have an active/historical school without blocking a fresh request,
-- and null requesters (legacy rows) are excluded.
CREATE UNIQUE INDEX IF NOT EXISTS schools_one_pending_per_requester
  ON schools (requested_admin_user_id)
  WHERE status = 'pending' AND requested_admin_user_id IS NOT NULL;
