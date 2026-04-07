import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateSetupToken } from '@/lib/schools-store'

async function requireSuperAdmin() {
  const { userId } = await auth()
  if (!userId) return null
  const client = await clerkClient()
  const user = await client.users.getUser(userId)
  if (user.publicMetadata?.role !== 'superadmin') return null
  return userId
}

export async function POST(request: NextRequest) {
  const userId = await requireSuperAdmin()
  if (!userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email } = await request.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const db = createServiceClient()
  const token = generateSetupToken()

  const { error } = await db.from('school_invites').insert({
    email: email.trim().toLowerCase(),
    token,
  })

  if (error) {
    console.error('invite error', error)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  return NextResponse.json({ token, inviteUrl: `/invite/${token}` })
}
