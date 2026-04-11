import { auth, clerkClient } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase'

// Server-side guard for /superadmin/**. Truth-source is `users.role` in the DB
// (schema: users table holds role='superadmin', school_id=null). We fall back
// to Clerk publicMetadata only if the user row doesn't exist yet — which can
// happen for a freshly-minted superadmin before their first sign-in writes.
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  let isSuperAdmin = userRow?.role === 'superadmin'

  if (!isSuperAdmin && !userRow) {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    isSuperAdmin = user.publicMetadata?.role === 'superadmin'
  }

  if (!isSuperAdmin) redirect('/dashboard')

  return <>{children}</>
}
