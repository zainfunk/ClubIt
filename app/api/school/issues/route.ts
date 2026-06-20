import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

export const dynamic = 'force-dynamic'

const STAFF: Role[] = ['admin', 'advisor', 'superadmin']

async function staffContext() {
  const { userId } = await auth()
  if (!userId) return { error: 'Unauthorized', status: 401 as const }
  const db = createServiceClient()
  const { data: row } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()
  const schoolId = (row?.school_id as string | null) ?? null
  const role = (row?.role as Role | undefined) ?? 'student'
  if (!schoolId) return { error: 'No school context', status: 400 as const }
  if (!STAFF.includes(role)) return { error: 'Forbidden', status: 403 as const }
  return { db, schoolId, role }
}

// GET /api/school/issues — open issue reports for the caller's school.
export async function GET() {
  const ctx = await staffContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { data } = await ctx.db
    .from('issue_reports')
    .select('id, message, reporter_name, status, created_at')
    .eq('school_id', ctx.schoolId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  return NextResponse.json({ issues: data ?? [] })
}

// PATCH /api/school/issues { id } — mark an issue resolved (school-scoped).
export async function PATCH(request: NextRequest) {
  const ctx = await staffContext()
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = (await request.json().catch(() => ({}))) as { id?: string }
  if (!body.id) {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await ctx.db
    .from('issue_reports')
    .update({ status: 'resolved' })
    .eq('id', body.id)
    .eq('school_id', ctx.schoolId)

  if (error) {
    return NextResponse.json({ error: 'Failed to resolve issue' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
