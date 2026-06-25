-- 0012 — One-time repair for the sign-in / role-association bug.
--
-- Root cause (fixed in code alongside this migration):
--   * /api/join's elevated (admin/advisor) path only wrote users.school_id when
--     the user row didn't already exist — but /api/user/sync always creates the
--     row first, so staff code-redeemers never had school_id persisted to the
--     DB (it lived only in the browser's localStorage). On a fresh device / after
--     sign-out the app saw "no school" and re-prompted for a code.
--   * /api/school/staff-requests approval then scoped its role UPDATE by that
--     never-set school_id (`... where id = ? and school_id = ?`), so it matched
--     zero rows, silently failed to grant the role, yet still burned the
--     single-use code.
--
-- This backfills the authoritative state from staff_access_requests. Idempotent:
-- it only fills NULL school_id / under-granted roles, so re-running is a no-op
-- and it never moves a user who already belongs to a school.

begin;

-- 1. APPROVED requests whose grant silently no-op'd (school_id was NULL):
--    attach the school AND grant the approved role.
update users u
set school_id = sar.school_id,
    role      = sar.requested_role
from staff_access_requests sar
where sar.user_id = u.id
  and sar.status  = 'approved'
  and u.school_id is null;

-- 2. PENDING requests where the redeemer was never attached to the school:
--    attach the school so routing stops sending them back to /join. Role stays
--    as-is — elevation still requires an explicit admin approval.
update users u
set school_id = sar.school_id
from staff_access_requests sar
where sar.user_id = u.id
  and sar.status  = 'pending'
  and u.school_id is null;

-- 3. Un-strand any user whose school_id points to a school that no longer exists
--    (e.g. a rejected pending school that was deleted without clearing the ref).
update users u
set school_id = null,
    role      = 'student'
where u.school_id is not null
  and not exists (select 1 from schools s where s.id = u.school_id);

commit;
