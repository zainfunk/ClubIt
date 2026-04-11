import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// GET: validate token and return school info + invite codes
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, name, district, contact_name, contact_email, status, student_invite_code, admin_invite_code, advisor_invite_code, setup_token_expires_at, setup_completed_at')
    .eq('setup_token', token)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid or expired setup link' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not active' }, { status: 403 })
  }

  if (school.setup_token_expires_at && new Date(school.setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 })
  }

  return NextResponse.json({
    name: school.name,
    district: school.district,
    contactName: school.contact_name,
    contactEmail: school.contact_email,
    studentInviteCode: school.student_invite_code,
    adminInviteCode: school.admin_invite_code,
    advisorInviteCode: school.advisor_invite_code,
    expiresAt: school.setup_token_expires_at,
    completedAt: school.setup_completed_at,
  })
}

// POST: mark setup as complete
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const db = createServiceClient()

  const { data: school } = await db
    .from('schools')
    .select('id, status, setup_token_expires_at')
    .eq('setup_token', token)
    .maybeSingle()

  if (!school) {
    return NextResponse.json({ error: 'Invalid setup link' }, { status: 404 })
  }

  if (school.status !== 'active') {
    return NextResponse.json({ error: 'This school is not active' }, { status: 403 })
  }

  if (school.setup_token_expires_at && new Date(school.setup_token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Setup link has expired' }, { status: 410 })
  }

  await db
    .from('schools')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', school.id)

  return NextResponse.json({ ok: true })
}
