-- 0021_open_registration.sql
--
-- Self-serve "open registration" for a single tenant (UConn): students create
-- their own account (Clerk), self-enrol into the school by verified email
-- domain, and SUBMIT a club for approval instead of needing an invite code.
--
-- Nothing here forks the multi-tenant model. Approved clubs are ordinary rows
-- in `clubs` under the existing UConn `schools` record, created through the
-- same code path as /api/school/clubs. The Shelton invite-code flow
-- (/api/join, /api/onboard) is untouched.
--
-- Idempotent.

begin;

-- ============================================================
-- 1. Open-registration flags on the tenant record
-- ============================================================
-- open_registration    : this school accepts self-serve signups (no code)
-- allowed_email_domain  : verified-email domain required to self-enrol, e.g.
--                         'uconn.edu'. NULL = no domain gate.
-- registration_slug     : public URL segment, e.g. 'uconn' -> /join/uconn.
--                         Generic so future open-enrollment schools reuse it.
alter table schools
  add column if not exists open_registration boolean not null default false,
  add column if not exists allowed_email_domain text,
  add column if not exists registration_slug text;

create unique index if not exists schools_registration_slug_idx
  on schools (registration_slug)
  where registration_slug is not null;

-- ============================================================
-- 2. Seed the UConn tenant
-- ============================================================
-- Active immediately (no superadmin approval needed — this school is us
-- opening the doors), with open registration on and gated to @uconn.edu.
-- Fixed UUID so re-running the migration is a no-op and downstream code can
-- rely on a stable id if ever needed (though the slug is the real handle).
insert into schools (
  id, name, district, contact_name, contact_email, status,
  open_registration, allowed_email_domain, registration_slug, setup_completed_at
) values (
  '00000000-0000-0000-0000-0000000000c0',
  'University of Connecticut',
  'UConn',
  'ClubIt Team',
  'team@clubit.app',
  'active',
  true,
  'uconn.edu',
  'uconn',
  now()
)
on conflict (id) do update set
  open_registration    = excluded.open_registration,
  allowed_email_domain = excluded.allowed_email_domain,
  registration_slug    = excluded.registration_slug;

-- ============================================================
-- 3. Club registration requests
-- ============================================================
-- One row per submission. status pending -> approved|denied. On approval the
-- reviewer creates a real club and we stamp created_club_id so the request
-- links to the live club. Mirrors staff_access_requests (0011): a per-user
-- request lifecycle with a reviewer decision.
create table if not exists club_registration_requests (
  id               text primary key,
  school_id        uuid not null references schools(id) on delete cascade,
  requester_id     text not null references users(id) on delete cascade,
  club_name        text not null,
  description      text not null,
  category         text,
  expected_members int,
  requester_role   text,                       -- 'president' | 'officer'
  contact_info     text,
  status           text not null default 'pending'
                     check (status in ('pending', 'approved', 'denied')),
  denial_reason    text,
  reviewer_id      text references users(id) on delete set null,
  reviewed_at      timestamptz,
  created_club_id  text references clubs(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- One PENDING request per user at a time. Denied/approved rows don't count,
-- so a denied user can resubmit. This is also the race-proof backstop for the
-- friendly "you already have a pending request" check in the API.
create unique index if not exists club_reg_one_pending_per_user
  on club_registration_requests (requester_id)
  where status = 'pending';

-- Reviewer queue: list pending for a school fast.
create index if not exists club_reg_school_status_idx
  on club_registration_requests (school_id, status);

-- ============================================================
-- 4. Row-Level Security
-- ============================================================
-- The actual mutations run through validated service-role API routes (as with
-- every other write in this app), which bypass RLS. These policies are the
-- enforced backstop for any anon-key/authenticated client access, and they
-- encode the intended trust model explicitly:
--
--   * club_reg_select     A requester can read ONLY their own rows. Reviewers
--                         (superadmins) can read everything, for the queue.
--   * club_reg_insert_own A requester can create a row only for THEMSELVES,
--                         only in the pending state, and only in the school
--                         they currently belong to (their self-enrolled UConn
--                         membership). They cannot open a request as/for
--                         someone else or pre-set a decided status.
--   * club_reg_update_own A requester can edit only their OWN row and only
--                         while it is pending (USING), and the edited row must
--                         STAY pending (WITH CHECK). That check is what stops a
--                         requester from self-approving: flipping status to
--                         'approved' fails the WITH CHECK. Once decided, the
--                         row is frozen to them.
--   * club_reg_review     Reviewers (superadmins) can update any row — this is
--                         the approve/deny path.
alter table club_registration_requests enable row level security;

drop policy if exists club_reg_select on club_registration_requests;
create policy club_reg_select on club_registration_requests
  for select to authenticated
  using (
    requester_id = app.current_user_id()
    or app.is_superadmin()
  );

drop policy if exists club_reg_insert_own on club_registration_requests;
create policy club_reg_insert_own on club_registration_requests
  for insert to authenticated
  with check (
    requester_id = app.current_user_id()
    and status = 'pending'
    and school_id = app.current_school_id()
  );

drop policy if exists club_reg_update_own on club_registration_requests;
create policy club_reg_update_own on club_registration_requests
  for update to authenticated
  using (
    requester_id = app.current_user_id()
    and status = 'pending'
  )
  with check (
    requester_id = app.current_user_id()
    and status = 'pending'
  );

drop policy if exists club_reg_review on club_registration_requests;
create policy club_reg_review on club_registration_requests
  for update to authenticated
  using (app.is_superadmin())
  with check (app.is_superadmin());

commit;
