-- 0011 — Staff access requests (anti-leak gate for admin/advisor codes).
--
-- Problem: even with single-use + expiry + optional domain binding (0005), a
-- LEAKED admin/advisor invite code let whoever redeemed it first — possibly a
-- student — instantly self-elevate. Single-use stops *extra* redemptions, not
-- the wrong *first* one.
--
-- Fix: redeeming an admin/advisor code no longer grants the role. It enrolls
-- the user as a student and files a pending request that an EXISTING admin /
-- superadmin must approve. The elevated role is only ever granted by an
-- explicit click from someone who already has it, so a leaked code can never
-- mint an admin on its own. (The first admin is still bootstrapped at school
-- approval via schools.requested_admin_user_id, so there's always an approver.)
--
-- Accessed only through service-role API routes (/api/join writes;
-- /api/school/staff-requests reads + decides), so RLS is enabled with NO
-- permissive policy = deny-all for anon/authenticated clients.

create table if not exists staff_access_requests (
  id text primary key,
  user_id text references users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  requested_role text not null check (requested_role in ('admin', 'advisor')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text references users(id) on delete set null
);

create index if not exists staff_access_requests_school_status_idx
  on staff_access_requests (school_id, status);

-- At most one open request per user (a leaked code can't be used to spam the
-- admin queue with hundreds of pending rows from the same account).
create unique index if not exists staff_access_requests_one_open_per_user
  on staff_access_requests (user_id) where status = 'pending';

alter table staff_access_requests enable row level security;
