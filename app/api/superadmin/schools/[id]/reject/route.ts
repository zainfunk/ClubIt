import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role !== 'superadmin') return null
  return userId
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const { error } = await db
    .from('schools')
    .delete()
    .eq('id', id)
    .eq('status', 'pending') // can only reject pending schools

  if (error) return NextResponse.json({ error: 'Failed to reject school' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
