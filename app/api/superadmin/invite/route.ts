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
  try {
    console.log('[invite] step 1: auth()')
    const { userId } = await auth()
    console.log('[invite] step 2: userId =', userId)
    if (!userId) return NextResponse.json({ error: 'Forbidden – not signed in' }, { status: 403 })

    console.log('[invite] step 3: clerkClient()')
    const client = await clerkClient()
    console.log('[invite] step 4: getUser')
    const user = await client.users.getUser(userId)
    console.log('[invite] step 5: role =', user.publicMetadata?.role)
    if (user.publicMetadata?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden – not superadmin' }, { status: 403 })
    }

    const { email } = await request.json()
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    console.log('[invite] step 6: createServiceClient')
    const db = createServiceClient()
    const token = generateSetupToken()

    console.log('[invite] step 7: insert school_invite')
    const { error } = await db.from('school_invites').insert({
      email: email.trim().toLowerCase(),
      token,
    })

    if (error) {
      console.error('[invite] db error', error)
      return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
    }

    console.log('[invite] done')
    return NextResponse.json({ token, inviteUrl: `/invite/${token}` })
  } catch (err) {
    console.error('[invite] unexpected error', err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
