import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * Superadmin-only inbox for marketing sales inquiries (the /contact form).
 *
 *   GET    -> list all contact_requests, newest first
 *   PATCH  -> { id, status } update the follow-up status
 *   DELETE -> { id } remove a request
 *
 * Auth mirrors /api/superadmin/schools: DB `users.role` is the source of
 * truth, with a Clerk publicMetadata fallback for freshly-minted superadmins.
 */
async function requireSuperAdmin() {
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

const STATUSES = ['new', 'contacted', 'archived'] as const
type Status = (typeof STATUSES)[number]

export async function GET() {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = createServiceClient()
  const { data, error } = await db
    .from('contact_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('contact-requests: fetch failed', error)
    return NextResponse.json({ error: 'Failed to fetch contact requests' }, { status: 500 })
  }

  return NextResponse.json({ requests: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  const status = body?.status as Status | undefined
  if (!id || !status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'id and a valid status are required' }, { status: 400 })
  }

  const db = createServiceClient()
  const { data, error } = await db
    .from('contact_requests')
    .update({ status })
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    console.error('contact-requests: update failed', error ?? 'no row')
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const db = createServiceClient()
  const { error } = await db.from('contact_requests').delete().eq('id', id)
  if (error) {
    console.error('contact-requests: delete failed', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
