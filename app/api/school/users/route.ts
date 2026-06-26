import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role, User } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/school/users — every user in the caller's school, overrides applied.
// Service-role read so it works on the phone shell where client-side RLS reads
// are unreliable (see lib/school-api.ts).
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceClient()

  const { data: callerRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()

  const schoolId = callerRow?.school_id as string | null
  if (!schoolId) {
    return NextResponse.json({ users: [] })
  }

  // Email is PII (these are minors). Only staff get classmates' emails; everyone
  // else sees names only (and their own email).
  const callerRole = callerRow?.role as Role | undefined
  const canSeeEmails = callerRole === 'admin' || callerRole === 'advisor' || callerRole === 'superadmin'

  const [{ data: userRows }, { data: overrideRows }] = await Promise.all([
    db.from('users').select('id, name, email, role, school_id, avatar_url').eq('school_id', schoolId).order('name'),
    db.from('user_overrides').select('user_id, name, email'),
  ])

  const overrides: Record<string, { name?: string | null; email?: string | null }> = {}
  for (const row of overrideRows ?? []) {
    overrides[row.user_id] = row
  }

  const users: User[] = (userRows ?? []).map((row) => {
    const o = overrides[row.id]
    const showEmail = canSeeEmails || row.id === userId
    return {
      id: row.id,
      name: o?.name?.trim() || row.name,
      email: showEmail ? (o?.email?.trim() || row.email) : '',
      role: row.role as Role,
      avatarUrl: row.avatar_url ?? undefined,
      schoolId: row.school_id ?? undefined,
    }
  })

  return NextResponse.json({ users })
}
