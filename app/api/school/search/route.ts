import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * GET /api/school/search?q=<query>&type=all|clubs|users
 *
 * Returns clubs and/or users in the signed-in user's school whose name
 * matches the query. Service role + explicit school scoping so every role
 * (student/advisor/admin) can search within their own school only.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const type = url.searchParams.get('type') ?? 'all'

  if (q.length < 1) return NextResponse.json({ clubs: [], users: [] })

  const db = createServiceClient()

  const { data: me } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  const schoolId = me?.school_id
  if (!schoolId) return NextResponse.json({ clubs: [], users: [] })

  const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`
  const wantClubs = type === 'all' || type === 'clubs'
  const wantUsers = type === 'all' || type === 'users'

  const [clubsRes, usersRes] = await Promise.all([
    wantClubs
      ? db.from('clubs').select('id, name, icon_url').eq('school_id', schoolId).ilike('name', pattern).order('name').limit(8)
      : Promise.resolve({ data: [] as { id: string; name: string; icon_url: string | null }[] }),
    wantUsers
      ? db.from('users').select('id, name, role, avatar_url').eq('school_id', schoolId).ilike('name', pattern).order('name').limit(8)
      : Promise.resolve({ data: [] as { id: string; name: string; role: string; avatar_url: string | null }[] }),
  ])

  const clubs = (clubsRes.data ?? []).map((c) => ({ id: c.id, name: c.name, iconUrl: c.icon_url ?? null }))
  const users = (usersRes.data ?? [])
    .filter((u) => u.id !== userId) // don't surface yourself
    .map((u) => ({ id: u.id, name: u.name, role: u.role, avatarUrl: u.avatar_url ?? null }))

  return NextResponse.json({ clubs, users })
}
