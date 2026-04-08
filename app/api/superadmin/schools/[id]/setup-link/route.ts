import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateSetupToken, setupTokenExpiresAt } from '@/lib/schools-store'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role !== 'superadmin') return null
  return userId
}

// Regenerate the one-time IT setup link for an active school
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const db = createServiceClient()

  const token = generateSetupToken()
  const expiry = setupTokenExpiresAt()

  const { data: school } = await db
    .from('schools')
    .select('id, status')
    .eq('id', id)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'School not found' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'Setup links can only be generated for active schools' }, { status: 409 })
  }

  const { error } = await db
    .from('schools')
    .update({
      setup_token: token,
      setup_token_expires_at: expiry,
      setup_completed_at: null, // reset completion so IT can re-visit
    })
    .eq('id', id)
    .eq('status', 'active')

  if (error) return NextResponse.json({ error: 'Failed to generate setup link' }, { status: 500 })

  return NextResponse.json({ setupLink: `/setup/${token}`, expiresAt: expiry })
}
