# Supabase migrations

This directory contains **only** forward migrations. Supabase's
auto-apply tooling (`supabase db push`, dashboard branching, Vercel
hooks, etc.) reads every `.sql` file here and applies it in filename
order. To keep that path clean:

- **Down migrations** live in `../rollbacks/` (not `migrations/`),
  because Supabase would otherwise treat `0001_*.down.sql` as a second
  migration with version `0001` and trip on a duplicate primary key
  in `supabase_migrations.schema_migrations`.
- **Operator one-shots** (`APPLY_ALL.sql`, `RESET_AND_APPLY.sql`,
  `RESET_TRACKER.sql`) live in `../scripts/`.

```
migrations/
  0000_baseline.sql                  -- copy of supabase/schema.sql; tables, app schema, helper functions, seed
  0001_users_rls_lockdown.sql        -- C-5: blocks self-promotion via direct INSERT/UPDATE
  0002_club_membership_rls.sql       -- C-4: tightens club-scoped SELECT to members only
  0003_pending_school_onboarding.sql -- C-3: schools.requested_admin_user_id column
  0004_secret_ballot.sql             -- H-3: poll/election votes are secret; aggregate RPCs added
  0005_invite_code_binding.sql       -- W2.5: single-use admin/advisor codes, email-domain bind
  0006_audit_log.sql                 -- W3.3: append-only audit_log table + app.audit() helper
  0007_club_dues.sql                 -- per-club dues amount + per-member club_dues_payments table
  0008_account_self_deletion.sql     -- 5.1.1(v): users.deleted_at tombstone for in-app account deletion
  0009_chat_moderation.sql           -- 1.2: chat_message_reports + user_blocks (UGC moderation)
  0010_push_device_tokens.sql        -- 4.2: device_push_tokens for APNs push notifications
  0011_staff_access_requests.sql     -- anti-leak: admin/advisor codes file a request that an existing admin must approve

rollbacks/
  *.down.sql                         -- one per forward migration; apply manually if you need to revert

scripts/
  APPLY_ALL.sql       -- 0000..0007 concatenated; one-shot for the SQL Editor
  RESET_AND_APPLY.sql -- DELETE tracker rows + APPLY_ALL + re-record
  RESET_TRACKER.sql   -- DELETE only (use when the schema is already correct)
```

## Applying

### Local (Supabase CLI)

```bash
supabase db reset       # wipes + re-applies all forward migrations in order
# OR for an existing DB:
supabase db push        # applies any migrations not yet recorded
```

### Production (recommended: SQL Editor, first run)

1. Open the Supabase dashboard → SQL Editor (the `</>` icon, not the
   Migrations tool — the Migrations tool tries to auto-record each run
   and trips on duplicate keys when re-applying).
2. Paste `supabase/scripts/APPLY_ALL.sql` (or `RESET_AND_APPLY.sql` if
   you need to clear stale tracker rows first).
3. Run.

Every forward migration is wrapped in `BEGIN/COMMIT` and is idempotent
(`if exists` / `if not exists`), so running one twice is a no-op.

## If you see `schema "app" does not exist (SQLSTATE 3F000)`

You skipped `0000_baseline.sql`. The `app` schema and the helper
functions (`app.current_user_id`, `app.is_school_admin`,
`app.club_member`, `app.club_in_scope`, etc.) are defined there. Apply
`0000_baseline.sql` first, then re-run whichever migration failed.

## If you see `duplicate key value violates "schema_migrations_pkey"`

`supabase db push` (or a Supabase Branching auto-deploy) is trying to
record a migration whose version is already in the tracker. Two cases:

- **The schema change you're about to apply is already applied.** Run
  `supabase/scripts/RESET_TRACKER.sql` from the SQL Editor to clear the
  tracker rows for `0000`–`0007`, then `supabase db push` again. The
  CLI re-applies (idempotent — no-op) and re-records cleanly.
- **The `*.down.sql` files used to be in `migrations/`.** They've been
  moved to `../rollbacks/`. If you have an older clone, `git pull` to
  pick up the move.

## Rollback

```bash
psql "$DATABASE_URL" < supabase/rollbacks/0007_club_dues.down.sql
# ...etc, reverse order
```

Down migrations exist for 0001–0007. The 0000 baseline has no down
because it represents the project's foundational schema.

## Adding a new migration

1. Create `migrations/00NN_<short_name>.sql` (numbered immediately
   after the highest existing forward migration).
2. Wrap in `begin; ... commit;` and use `if exists` / `if not exists`
   so the migration is idempotent.
3. Create a paired `rollbacks/00NN_<short_name>.down.sql` that reverses
   the change.
4. Add a row to the table at the top of this file.
5. If the migration introduces or changes a route that uses
   `createServiceClient()`, update
   `docs/security/W2.4-SERVICE-ROLE-INVENTORY.md`.
