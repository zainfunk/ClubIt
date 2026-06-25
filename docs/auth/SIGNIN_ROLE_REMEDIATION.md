# Goal: Solve Sign-in & Role Association For Good (iOS-compatible)

Status: EXECUTED (2026-06-24) · Owner: Zain · Created: 2026-06-24

> Implemented in one pass. Phase 0 data repair applied live (migration
> `0012_signin_role_repair.sql`). I1/I2/I11 (join + approval), I5 (setup-link
> redaction), I6 (redirect re-eval), I7 (shared `requireSuperAdmin`), I8/I9
> (approve code reset + admin-less guard) done. I4 (reject strand) found to be a
> **non-bug** — `users.school_id` FK is `ON DELETE SET NULL` (verified live), so
> reject auto-nulls it. I10 invite-code uniqueness already enforced by live
> `UNIQUE` constraints. Regression test in
> `tests/security/rls/test_signin_role_persistence.spec.ts`. Full `tsc` + `next
> build` green.

## North-star goal

Make school-and-role association **correct, durable, and self-healing** across every
sign-up path, on web **and** the native iOS webview, so that:

- Any user who redeems a valid code (student / admin / advisor) has
  `users.school_id` written to the **database immediately**, and it persists across
  devices, sign-outs, and cleared caches — **never a second code prompt**.
- `users.role` and `users.school_id` are **always consistent**: no flow leaves one
  set without the other, and no UPDATE is scoped by a column that may be null.
- Staff approval **reliably** grants the role and is **idempotent**.
- A single-use code is **never burned unless a real elevation succeeded**.
- **No user can be stranded** (unable to onboard *and* unable to join) by any
  reject / switch / account-churn path.
- **No auth-critical state depends on localStorage or client-side Supabase RLS**
  (this is what makes it work on the iOS shell).
- Setup / invite links never over-expose invite codes.
- All superadmin routes enforce authorization uniformly.
- Each flow is covered by a regression test.

## Architectural principle (the one rule that fixes the class of bugs)

> **The DB (`users.school_id`, `users.role`) is the single source of truth.
> localStorage primes the UI but is authoritative for nothing. Every association
> write goes through a service-role server route and is scoped by `id` only.**

All routing/role reads already flow through `/api/user/sync` (service role), which is
iOS-safe. The bugs all come from (a) *not* writing `school_id` to the DB, or
(b) scoping a write by a `school_id` that is null. Both violate the rule above.

## iOS compatibility constraints (must hold for every change)

1. All auth-critical reads/writes go through **service-role API routes** — never
   client `supabase.from()` (the Clerk→Supabase JWT bridge is unreliable in the
   webview; see `docs` data-pattern notes).
2. localStorage is a **render accelerator only**. The DB must re-derive correct
   state on any device with an empty cache (the current cofounder bug is 100% a
   localStorage-as-source-of-truth failure).
3. Clerk `publicMetadata.role` is **mirrored best-effort**, never authoritative for
   routing. DB wins; `sync` reconciles Clerk to the DB.
4. Redirect logic must not **loop or flap** in the webview (native shell uses
   `allowNavigation`; a loop traps the user).
5. `npm run build:ios` + `cap sync` stay green; no new native dependency required.

---

## Complete issue inventory (everything this goal closes)

### P0 — The cofounder cascade (active, blocking)
- **I1.** `/api/join` elevated path only writes `school_id` inside `if (!existingUser)`;
  `/api/user/sync` always creates the row first, so staff joiners never persist
  `school_id`. (`app/api/join/route.ts:153-165`)
- **I2.** Staff approval scopes the role UPDATE by the never-set `school_id`
  (`.eq('school_id', requester.schoolId)`), matching 0 rows with no error; it also
  fails to set `school_id`. (`app/api/school/staff-requests/route.ts:123-127`)
- **I3.** Cascade fallout: approval still **burns** the single-use code
  (`staff-requests:136-142`); `sync` then reverts the Clerk role to the stale DB
  role (`sync:49-53`); re-entry of the burned code returns **410** → hard lockout.

### P1 — High
- **I4.** Reject strands the user: `reject` deletes the school row but never clears the
  requester's `users.school_id`, so they can't re-onboard (`onboard:53` 409) and can't
  join (`join:129` 409). (`app/api/superadmin/schools/[id]/reject/route.ts:24-28`)
- **I5.** Setup link over-exposes codes: `GET /api/setup/[token]` returns all three
  invite codes for the whole 7-day window, ignoring `setup_completed_at`.
  (`app/api/setup/[token]/route.ts:23-51`)
- **I6.** Stale-cache mis-routing: `mock-auth` enables redirects from the cached
  session before the DB sync returns, and the redirect guard only resets when the
  *user id* changes — so a just-approved admin can be pinned on `/onboard/pending`
  until a hard reload. (`lib/mock-auth.tsx:142-161, 211-221`)

### P2 — Medium
- **I7.** Non-uniform superadmin authz: only `approve` checks the DB role; `reject`,
  `suspend`, `regenerate-codes`, `setup-link` trust Clerk metadata only.
- **I8.** `approve` regenerates admin/advisor codes without clearing `*_code_used_at`
  (and sets expiry inconsistently vs `regenerate-codes`) → can mint an
  already-burned code. (`approve:68-81` vs `regenerate-codes:39-48`)
- **I9.** Onboard FK `requested_admin_user_id` is `ON DELETE SET NULL`; if that user
  row churns pre-approval, the school activates **admin-less** with no warning.

### P3 — Low / hardening
- **I10.** `generateInviteCode` has no uniqueness/retry guard and no confirmed
  `UNIQUE` constraint on the code columns. (`lib/schools-store.ts:27-32`)
- **I11.** Several role/school_id UPDATEs check `error` but not affected-row count, so
  0-row no-ops pass as success (the root enabler of I2). Add row-count assertions.

### Cross-cutting
- **I12.** One-time **data repair** for users already broken by I1/I2/I4.
- **I13.** **Regression tests** for every sign-up path.

---

## Fix design (per issue)

### I1 — `/api/join`: always persist `school_id` for staff joiners
Replace the `if (!existingUser){ upsert school_id }` with an unconditional attach
(role untouched; elevation still happens only on approval):
```ts
// elevated branch
const { error: enrollErr } = existingUser
  ? await db.from('users').update({ school_id: school.id }).eq('id', userId)
  : await db.from('users').upsert(
      { id: userId, name, email: callerEmail, school_id: school.id, role: 'student' },
      { onConflict: 'id' })
if (enrollErr) return failClosed()   // no school link, no request
```

### I2 — staff approval: set `school_id`, scope by `id`, assert rows
```ts
const { data: updated, error: roleErr } = await db.from('users')
  .update({ role: grantedRole, school_id: requester.schoolId })
  .eq('id', claimed.user_id)
  .select('id').maybeSingle()
if (roleErr || !updated) return NextResponse.json({ error: 'Failed to grant role' }, { status: 500 })
// only NOW consume the single-use code (unchanged block runs after success)
```
Safe because the request row was already claimed `.eq('school_id', requester.schoolId)`,
proving it belongs to this school. Setting `school_id` here **self-heals** any cofounder
whose row currently has `school_id = null`. Dropping the null-prone filter removes I2.

### I3 — verify the cascade is gone
With I1+I2: approval grants role → `sync` keeps Clerk role → code consumed only on
real elevation → no 410 on a legitimate redeemer. Covered by tests (I13).

### I4 — reject un-strands the requester
In `reject`, capture and clear before/after deleting the school:
```ts
await db.from('users').update({ school_id: null, role: 'student' }).eq('school_id', school.id)
// then delete the school row
```
Also handled retroactively by the I12 repair (rows pointing at deleted schools).

### I5 — setup link stops leaking codes
`GET /api/setup/[token]`: if `setup_completed_at` is set **or** the school's admin code
is already consumed (an admin exists), return the school name + a "setup complete"
state with **codes redacted** (or 410). Auto-set `setup_completed_at` the first time an
admin successfully provisions for the school, so the door closes without manual action.

### I6 — redirect re-evaluates against authoritative state
Keep the cache for fast first paint, but enable **redirects** only from synced data:
either reset `hasRedirected.current = false` in the `finally` of `syncSchoolContext`
(one extra evaluation against fresh status/role, loop-safe), or gate the redirect
effect on a separate `syncedOnce` flag set after the DB sync. Verify no webview flap.

### I7 — shared DB-first `requireSuperAdmin`
Extract the DB-then-Clerk check from `approve` into `lib/auth/require-superadmin.ts`;
use it in `reject`, `suspend`, `regenerate-codes`, `setup-link`.

### I8 — `approve` resets `used_at` + consistent expiry
Add `admin_code_used_at: null, advisor_code_used_at: null` to the approve code-mint
UPDATE, and unify the expiry policy with `regenerate-codes` (decision: **no default
expiry** on mint for both; rotation is explicit via regenerate). 

### I9 — guard admin-less activation
At `approve`, if `requested_admin_user_id` is null and no admin exists for the school,
return the existing warning shape so the operator promotes someone manually.

### I10 — invite-code uniqueness
Migration: `UNIQUE` on `schools.student_invite_code, admin_invite_code,
advisor_invite_code` (partial / where not null). Retry `generateInviteCode` on `23505`.

### I11 — affected-row assertions
Audit every role/`school_id` UPDATE (`join`, `approve`, `reject`, `users/[id]/role`)
to assert a row was returned; surface 500 on 0 rows instead of silent success.

### I12 — one-time data repair (idempotent SQL migration, via Supabase MCP)
1. Users with an **approved** `staff_access_requests` row but `school_id IS NULL`
   → set `school_id` = request's school_id **and** `role` = `requested_role`.
2. Users with a **pending** request but `school_id IS NULL`
   → set `school_id` = request's school_id (role stays student).
3. Users whose `school_id` references a non-existent school → set `school_id = NULL`,
   `role = 'student'` (un-strand).
Verify table/column names against current schema before applying.

### I13 — regression tests (vitest)
- staff join persists `school_id`; re-sync with empty cache keeps the school (no re-prompt).
- approval grants role+school_id, is idempotent, and only then consumes the code.
- reject un-strands (user can re-onboard afterward).
- setup link redacts codes once setup is complete.
- (optional) invite-code collision retry.

---

## Phasing

- **Phase 0 — Data repair (I12).** Ship first, independently; immediately un-sticks
  current cofounders. Pure DB; zero app/iOS risk.
- **Phase 1 — Core (I1, I2, I11 on those two).** Kills the cofounder cascade.
- **Phase 2 — Strand & exposure (I4, I5, I6).**
- **Phase 3 — Consistency (I7, I8, I9).**
- **Phase 4 — Hardening + tests (I10, I11 sweep, I13)** and final
  `npm run build:ios` + `cap sync` verification.

## Done = all true
- [ ] New device / cleared cache after redeeming any code → lands in-app, **no** re-prompt.
- [ ] Approving a staff request grants role+school_id; re-running is a no-op.
- [ ] No code is consumed unless an elevation actually succeeded.
- [ ] Rejected/cleared users can re-onboard or re-join — never stranded.
- [ ] No auth-critical read/write uses client RLS or localStorage as source of truth.
- [ ] Setup/invite links don't expose codes past their purpose.
- [ ] All five superadmin routes share one DB-first authz check.
- [ ] Regression tests green; `build:ios` + `cap sync` green.
