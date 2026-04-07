import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, district, contactName, contactEmail } = body

  if (!name || !contactName || !contactEmail) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = createServiceClient()

  // Check if this user already has a pending/active school
  const { data: existingUser } = await db
    .from('users')
    .select('school_id')
    .eq('id', userId)
    .maybeSingle()

  if (existingUser?.school_id) {
    return NextResponse.json({ error: 'You are already enrolled in a school' }, { status: 409 })
  }

  // Create the school with status=pending (no invite codes yet — generated on approval)
  const { data: school, error } = await db
    .from('schools')
    .insert({
      name: name.trim(),
      district: district?.trim() || null,
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim().toLowerCase(),
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    console.error('onboard error', error)
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
  }

  // Tag the submitting user as admin of this school (pending)
  await db
    .from('users')
    .upsert({ id: userId, school_id: school.id, role: 'admin' }, { onConflict: 'id' })

  return NextResponse.json({ schoolId: school.id })
}
