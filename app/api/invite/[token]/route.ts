import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { generateInviteCode } from '@/lib/schools-store'

function ensureDevelopmentOnly() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}

// GET — validate token and return invite data
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const blocked = ensureDevelopmentOnly()
  if (blocked) return blocked

  const { token } = await params
  const db = createServiceClient()

  const { data: invite } = await db
    .from('school_invites')
    .select('id, email, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 })
  }

  return NextResponse.json({ email: invite.email })
}

// POST — submit school details, create the school, mark invite used
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const blocked = ensureDevelopmentOnly()
  if (blocked) return blocked

  const { token } = await params
  const db = createServiceClient()

  const { data: invite } = await db
    .from('school_invites')
    .select('id, email, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invalid invite link' }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: 'This invite link has already been used' }, { status: 410 })
  }

  const body = await request.json()
  const { name, district, contactName } = body

  if (!name || !contactName) {
    return NextResponse.json({ error: 'School name and contact name are required' }, { status: 400 })
  }

  const studentCode = generateInviteCode('STU')
  const adminCode = generateInviteCode('ADM')
  const advisorCode = generateInviteCode('ADV')

  // Create the school as active immediately (superadmin already approved by sending the invite)
  const { data: school, error } = await db
    .from('schools')
    .insert({
      name: name.trim(),
      district: district?.trim() || null,
      contact_name: contactName.trim(),
      contact_email: invite.email,
      status: 'active',
      student_invite_code: studentCode,
      admin_invite_code: adminCode,
      advisor_invite_code: advisorCode,
    })
    .select()
    .single()

  if (error) {
    console.error('school create error', error)
    return NextResponse.json({ error: 'Failed to create school' }, { status: 500 })
  }

  // Mark invite as used
  await db
    .from('school_invites')
    .update({ used_at: new Date().toISOString(), school_id: school.id })
    .eq('id', invite.id)

  return NextResponse.json({
    schoolName: school.name,
    studentInviteCode: studentCode,
    adminInviteCode: adminCode,
    advisorInviteCode: advisorCode,
  })
}
