import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { generateSetupToken } from '@/lib/schools-store'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Forbidden - not signed in' }, { status: 403 })

    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    if (user.publicMetadata?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - not superadmin' }, { status: 403 })
    }

    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const db = createServiceClient()
    const token = generateSetupToken()

    const { error } = await db.from('school_invites').insert({
      email: email.trim().toLowerCase(),
      token,
    })

    if (error) {
      console.error('[invite] db error', error)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    return NextResponse.json({ token, inviteUrl: `/invite/${token}` })
  } catch (err) {
    console.error('[invite] unexpected error', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
