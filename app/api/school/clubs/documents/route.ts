import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase'
import { Role } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'club-documents'
const MAX_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

type Requester = { userId: string; schoolId: string; role: Role }

async function getRequester(): Promise<Requester | null> {
  const { userId } = await auth()
  if (!userId) return null
  const db = createServiceClient()
  const { data: userRow } = await db
    .from('users')
    .select('school_id, role')
    .eq('id', userId)
    .maybeSingle()
  if (!userRow?.school_id) return null
  return { userId, schoolId: userRow.school_id as string, role: userRow.role as Role }
}

// Resolve the club and figure out what the requester may do with its documents.
// canView = admins, the advisor, or a member. canManage = admins or the advisor.
async function loadClubAccess(
  db: ReturnType<typeof createServiceClient>,
  requester: Requester,
  clubId: string,
): Promise<{ canView: boolean; canManage: boolean } | null> {
  const { data: club } = await db
    .from('clubs')
    .select('id, advisor_id')
    .eq('id', clubId)
    .eq('school_id', requester.schoolId)
    .maybeSingle()
  if (!club) return null

  const isAdmin = requester.role === 'admin' || requester.role === 'superadmin'
  const isAdvisor = club.advisor_id === requester.userId
  const canManage = isAdmin || isAdvisor
  if (canManage) return { canView: true, canManage: true }

  const { data: member } = await db
    .from('memberships')
    .select('user_id')
    .eq('club_id', clubId)
    .eq('user_id', requester.userId)
    .maybeSingle()
  return { canView: !!member, canManage: false }
}

// GET ?clubId=X — list documents (with short-lived signed download URLs).
export async function GET(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clubId = new URL(request.url).searchParams.get('clubId')
  if (!clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })

  const db = createServiceClient()
  const access = await loadClubAccess(db, requester, clubId)
  if (!access) return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  if (!access.canView) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

  const { data: rows } = await db
    .from('club_documents')
    .select('id, name, content_type, size_bytes, uploaded_by, storage_path, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  const documents = await Promise.all(
    (rows ?? []).map(async (r) => {
      const signed = await db.storage
        .from(BUCKET)
        .createSignedUrl(r.storage_path as string, 3600, { download: r.name as string })
      return {
        id: r.id as string,
        name: r.name as string,
        contentType: r.content_type as string,
        sizeBytes: Number(r.size_bytes),
        uploadedBy: r.uploaded_by as string,
        createdAt: r.created_at as string,
        url: signed.data?.signedUrl ?? null,
      }
    }),
  )

  return NextResponse.json({ documents, canManage: access.canManage })
}

// POST (multipart) clubId + file — upload a document (advisors/admins only).
export async function POST(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await request.formData()
  const clubId = typeof form.get('clubId') === 'string' ? (form.get('clubId') as string).trim() : ''
  const file = form.get('file')
  if (!clubId) return NextResponse.json({ error: 'clubId is required' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large (max 15MB).' }, { status: 413 })
  }

  const db = createServiceClient()
  const access = await loadClubAccess(db, requester, clubId)
  if (!access) return NextResponse.json({ error: 'Club not found' }, { status: 404 })
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only advisors and admins can upload documents' }, { status: 403 })
  }

  const id = `doc-${randomUUID()}`
  const path = `${clubId}/${id}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false })
  if (uploadError) {
    console.error('document upload error', uploadError)
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 })
  }

  const name = (file.name || 'document').slice(0, 200)
  const { error: insertError } = await db.from('club_documents').insert({
    id,
    club_id: clubId,
    uploaded_by: requester.userId,
    name,
    storage_path: path,
    content_type: file.type,
    size_bytes: file.size,
    created_at: new Date().toISOString(),
  })
  if (insertError) {
    await db.storage.from(BUCKET).remove([path])
    console.error('document insert error', insertError)
    return NextResponse.json({ error: 'Failed to save document' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id })
}

// DELETE { documentId } — remove a document (advisors/admins only).
export async function DELETE(request: NextRequest) {
  const requester = await getRequester()
  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : ''
  if (!documentId) return NextResponse.json({ error: 'documentId is required' }, { status: 400 })

  const db = createServiceClient()
  const { data: doc } = await db
    .from('club_documents')
    .select('id, club_id, storage_path')
    .eq('id', documentId)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const access = await loadClubAccess(db, requester, doc.club_id as string)
  if (!access) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (!access.canManage) {
    return NextResponse.json({ error: 'Only advisors and admins can delete documents' }, { status: 403 })
  }

  await db.storage.from(BUCKET).remove([doc.storage_path as string])
  const { error } = await db.from('club_documents').delete().eq('id', documentId)
  if (error) return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
