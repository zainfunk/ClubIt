import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Returns the caller's userId iff they are a platform superadmin, else null.
 *
 * Source of truth is `users.role` in the DB (which `/api/user/sync` keeps
 * authoritative); we fall back to Clerk `publicMetadata.role` only if the DB
 * row is missing or the Clerk mirror happens to be ahead. Checking the DB FIRST
 * keeps every superadmin route consistent — previously only `/approve` was
 * DB-aware, so a superadmin whose best-effort Clerk metadata patch had lagged
 * could approve a school but got 403 from reject / suspend / regenerate-codes /
 * setup-link.
 */
export async function requireSuperAdmin(): Promise<string | null> {
  const { userId } = await auth()
  if (!userId) return null

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  if (userRow?.role === 'superadmin') return userId

  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role === 'superadmin') return userId

  return null
}
