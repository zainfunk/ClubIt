import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * One-time endpoint to promote a user to superadmin.
 * Requires a secret token to prevent misuse.
 * DELETE THIS ROUTE AFTER USE.
 */
const PROMOTE_SECRET = 'clubit-promote-2024'

export async function POST(request: NextRequest) {
  const { secret } = await request.json()
  if (secret !== PROMOTE_SECRET) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 403 })
  }

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = createServiceClient()

  // Update role in database
  const { error: dbError } = await db
    .from('users')
    .update({ role: 'superadmin', school_id: null })
    .eq('id', userId)

  if (dbError) {
    // User row might not exist yet — try upsert
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    const { error: upsertError } = await db
      .from('users')
      .upsert({
        id: userId,
        name: clerkUser.fullName ?? clerkUser.username ?? 'Superadmin',
        email: clerkUser.primaryEmailAddress?.emailAddress ?? '',
        role: 'superadmin',
        school_id: null,
      }, { onConflict: 'id' })

    if (upsertError) {
      return NextResponse.json({ error: 'DB error', detail: upsertError.message }, { status: 500 })
    }
  }

  // Update Clerk metadata
  try {
    const client = await clerkClient()
    const clerkUser = await client.users.getUser(userId)
    await client.users.updateUserMetadata(userId, {
      publicMetadata: { ...clerkUser.publicMetadata, role: 'superadmin' },
    })
  } catch (err) {
    console.warn('Clerk metadata update failed:', err)
  }

  return NextResponse.json({ success: true, userId, role: 'superadmin' })
}
