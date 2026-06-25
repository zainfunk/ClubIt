'use client'

import { useIsMobilePhone } from '@/components/mobile/useIsAdminPhone'
import ClubDetailMobile from '@/components/mobile/screens/ClubDetail'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  saveSession, upsertRecord,
} from '@/lib/attendance-store'
import { computeMeetingDuration } from '@/lib/rewards/hours'
import { Input } from '@/components/ui/input'
import {
  Users, Clock, MapPin, Globe, Crown, CheckCircle, XCircle,
  ClockIcon, Vote, Plus, Trash2, UserCheck, Pencil, Newspaper, Camera,
  MessageCircle, Tv, Video, Link as LinkIcon, QrCode, Copy, ArrowLeft, Mail, DollarSign,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { User, Club, ClubDuesPayment, JoinRequest, LeadershipPosition, Poll, ClubEvent, ClubNews as ClubNewsType, SocialLink, SocialPlatform, MeetingTime, AttendanceRecord, AttendanceSession } from '@/types'
import Avatar from '@/components/Avatar'
import ConfirmDialog from '@/components/ConfirmDialog'
import ClubNews from '@/components/clubs/ClubNews'
import ClubEvents from '@/components/clubs/ClubEvents'
import MemberHoursTable from '@/components/clubs/MemberHoursTable'
import { toast } from 'sonner'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** CSPRNG-backed short ID. Replaces Math.random per finding C-7. */
function csprngHex8(): string {
  const buf = new Uint8Array(4)
  globalThis.crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  const cls = 'w-4 h-4'
  switch (platform) {
    case 'instagram': return <Camera className={cls} />
    case 'twitter':   return <MessageCircle className={cls} />
    case 'facebook':  return <Tv className={cls} />
    case 'youtube':   return <Video className={cls} />
    case 'website':   return <Globe className={cls} />
    default:          return <LinkIcon className={cls} />
  }
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram', twitter: 'Twitter', facebook: 'Facebook',
  youtube: 'YouTube', discord: 'Discord', website: 'Website', other: 'Other',
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ClubDetailPage({ params }: PageProps) {
  const mobile = useIsMobilePhone()
  if (mobile) return <ClubDetailMobile />
  return <ClubDetailDesktop params={params} />
}

function ClubDetailDesktop({ params }: PageProps) {
  const { id } = use(params)
  const { currentUser, devRole } = useMockAuth()

  // Core state — loaded from Supabase on mount
  const [clubs, setClubs] = useState<Club[]>([])
  const [requests, setRequests] = useState<JoinRequest[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [clubLoading, setClubLoading] = useState(true)
  const [usersById, setUsersById] = useState<Record<string, User>>({})

  const [clubEvents, setClubEvents] = useState<ClubEvent[]>([])
  const [clubNews, setClubNews] = useState<ClubNewsType[]>([])
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [duesPayments, setDuesPayments] = useState<ClubDuesPayment[]>([])

  async function loadDetail(signal: AbortSignal) {
    const res = await fetch(`/api/school/clubs/${id}`, { cache: 'no-store', signal })
    if (signal.aborted) return
    if (!res.ok) {
      setClubs([])
      setRequests([])
      setPolls([])
      setUsersById({})
      setClubEvents([])
      setClubNews([])
      setAttendanceRecords([])
      setDuesPayments([])
      setClubLoading(false)
      return
    }
    const detail = await res.json()
    setClubs([detail.club])
    setRequests(detail.requests)
    setPolls(detail.polls)
    setUsersById(detail.usersById)
    setClubEvents(detail.events)
    setClubNews(detail.news)
    setAttendanceRecords(detail.attendanceRecords)
    setDuesPayments(detail.duesPayments ?? [])
    setClubLoading(false)
  }

  useEffect(() => {
    // Wait for auth to initialise before fetching. Do NOT call setClubLoading(false)
    // here — keeping it true prevents notFound() from firing before the fetch runs.
    if (!currentUser.id) return

    const controller = new AbortController()
    setClubLoading(true)
    loadDetail(controller.signal).catch((e) => {
      if (e.name !== 'AbortError') {
        setClubs([])
        setClubLoading(false)
      }
    })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser.id])

  // Poll for join-request status changes when the student has a pending request.
  // The admin approves server-side; the student's page has no real-time channel,
  // so we re-fetch every 8 seconds until the request resolves.
  const myPendingRequest = requests.find(
    (r) => r.userId === currentUser.id && r.status === 'pending'
  )
  useEffect(() => {
    if (!myPendingRequest || !currentUser.id) return

    const controller = new AbortController()
    const interval = setInterval(() => {
      loadDetail(controller.signal).catch((e) => {
        if (e.name !== 'AbortError') console.error('poll error', e)
      })
    }, 8000)

    return () => {
      clearInterval(interval)
      controller.abort()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!myPendingRequest, currentUser.id, id])

  // Edit mode for club header info (advisor)
  const [editMode, setEditMode] = useState(false)
  const [editIcon, setEditIcon] = useState('')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editSocialLinks, setEditSocialLinks] = useState<SocialLink[]>([])
  const [newSocialPlatform, setNewSocialPlatform] = useState<SocialPlatform>('instagram')
  const [newSocialUrl, setNewSocialUrl] = useState('')

  // Leadership management
  const [newPositionTitle, setNewPositionTitle] = useState('')
  const [appointSelections, setAppointSelections] = useState<Record<string, string>>({})

  // Capacity editing
  const [editingCapacity, setEditingCapacity] = useState(false)
  const [capacityInput, setCapacityInput] = useState('')
  const [capacityUnlimited, setCapacityUnlimited] = useState(false)

  // Meeting time management
  const [newMeetingDay, setNewMeetingDay] = useState<number>(1)
  const [newMeetingStart, setNewMeetingStart] = useState('15:00')
  const [newMeetingEnd, setNewMeetingEnd] = useState('16:00')
  const [newMeetingLocation, setNewMeetingLocation] = useState('')

  // Event creation / editing (editingEventId !== null => editing existing)
  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventDesc, setNewEventDesc] = useState('')
  const [newEventDate, setNewEventDate] = useState('')
  const [newEventLocation, setNewEventLocation] = useState('')
  const [newEventPublic, setNewEventPublic] = useState(true)

  // News creation
  const [showNewsForm, setShowNewsForm] = useState(false)
  const [newNewsTitle, setNewNewsTitle] = useState('')
  const [newNewsContent, setNewNewsContent] = useState('')
  const [newNewsPinned, setNewNewsPinned] = useState(false)

  // Poll creation / editing
  const [showPollForm, setShowPollForm] = useState(false)
  const [editingPollId, setEditingPollId] = useState<string | null>(null)
  const [pollPositionTitle, setPollPositionTitle] = useState('')
  const [pollCandidateIds, setPollCandidateIds] = useState<string[]>([])

  // QR / attendance session state (advisor)
  const [showQrForm, setShowQrForm] = useState(false)
  const [qrDate, setQrDate] = useState(() => new Date().toISOString().split('T')[0])
  const [qrExpiry, setQrExpiry] = useState(30) // minutes
  const [qrDistance, setQrDistance] = useState(0) // meters, 0 = disabled
  const [qrCaptureLocation, setQrCaptureLocation] = useState(false)
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null)
  const [copied, setCopied] = useState(false)

  // Manual attendance editing (advisor)
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split('T')[0])
  const [showManual, setShowManual] = useState(false)

  // Dues editing (advisor)
  const [editingDues, setEditingDues] = useState(false)
  const [duesInput, setDuesInput] = useState('')

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string; description?: string; confirmLabel?: string; variant?: 'danger' | 'default'; onConfirm: () => void
  } | null>(null)

  function confirm(opts: NonNullable<typeof confirmDialog>) {
    setConfirmDialog(opts)
  }

  const foundClub = clubs.find((c) => c.id === id)
  if (clubLoading) return null
  if (!foundClub) notFound()
  const club = foundClub!

  function resolveUser(userId: string): User | undefined {
    return usersById[userId] ?? (currentUser.id === userId ? currentUser : undefined)
  }

  const advisor = resolveUser(club.advisorId)
  const members = club.memberIds.map((mid) => resolveUser(mid)).filter(Boolean)

  const isAdvisor =
    currentUser.role === 'admin' ||
    devRole === 'admin' ||
    club.advisorId === currentUser.id ||
    devRole === 'advisor'
  const isMember = club.memberIds.includes(currentUser.id) || isAdvisor
  const canCreateContent = isAdvisor || club.eventCreatorIds.includes(currentUser.id)
  const isFull = club.capacity !== null && club.memberIds.length >= club.capacity

  const myRequest = requests.find((r) => r.clubId === id && r.userId === currentUser.id)
  const pendingRequests = requests
    .filter((r) => r.clubId === id && r.status === 'pending')
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())

  const clubPolls = polls.filter((p) => p.clubId === id)

  // Per-member attendance
  const memberAttendance = club.memberIds.map((mid) => {
    const user = resolveUser(mid)
    const records = attendanceRecords.filter((r) => r.userId === mid)
    const present = records.filter((r) => r.present).length
    return { user, records, total: records.length, present }
  })

  // My attendance (student)
  const myAttendance = attendanceRecords.filter((r) => r.userId === currentUser.id)
  const myPresent = myAttendance.filter((r) => r.present).length

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // --- Join request handlers ---
  async function handleRequest() {
    if (myRequest || isMember) return
    const ok = await patch({ action: 'join' })
    if (ok) toast.success('Join request sent!')
  }

  async function handleLeave() {
    confirm({
      title: 'Leave this club?',
      description: 'You can request to rejoin later.',
      confirmLabel: 'Leave',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await patch({ action: 'leave' })
        if (ok) toast.success('Left the club')
      },
    })
  }

  async function handleApprove(requestId: string) {
    const req = requests.find((r) => r.id === requestId)
    if (!req || club.memberIds.includes(req.userId) || isFull) return
    await patch({ action: 'approve', requestId })
  }

  async function handleReject(requestId: string) {
    confirm({
      title: 'Reject this request?',
      description: 'The student will need to submit a new request to join.',
      confirmLabel: 'Reject',
      variant: 'danger',
      onConfirm: () => patch({ action: 'reject', requestId }),
    })
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    try {
      const res = await fetch(`/api/school/clubs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? `Action failed (${res.status})`)
        return false
      }
      const controller = new AbortController()
      await loadDetail(controller.signal)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error — please try again')
      return false
    }
  }

  async function toggleAutoAccept() {
    await patch({ action: 'toggle_auto_accept' })
  }

  function handleDeleteClub() {
    confirm({
      title: `Delete ${club.name}?`,
      description: 'This permanently removes the club and all of its members, events, news, polls, dues and attendance. This cannot be undone.',
      confirmLabel: 'Delete Club',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/school/clubs/${id}`, { method: 'DELETE' })
          if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            toast.error(data.error ?? 'Failed to delete club')
            return
          }
          toast.success('Club deleted')
          window.location.href = '/clubs'
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Network error — please try again')
        }
      },
    })
  }

  // --- Edit mode ---
  function startEdit() {
    setEditIcon(club.iconUrl ?? '')
    setEditDescription(club.description)
    setEditTags(club.tags?.join(', ') ?? '')
    setEditSocialLinks([...club.socialLinks])
    setEditMode(true)
  }

  async function saveEdit() {
    const newIcon = editIcon.trim() || club.iconUrl
    const newDesc = editDescription.trim() || club.description
    const newTags = editTags ? editTags.split(',').map((t) => t.trim()).filter(Boolean) : club.tags
    await patch({ action: 'save_edit', iconUrl: newIcon, description: newDesc, tags: newTags, socialLinks: editSocialLinks })
    setEditMode(false)
  }

  function addSocialLink() {
    if (!newSocialUrl.trim()) return
    setEditSocialLinks((prev) => [...prev, { platform: newSocialPlatform, url: newSocialUrl.trim() }])
    setNewSocialUrl('')
  }

  function removeSocialLink(i: number) {
    setEditSocialLinks((prev) => prev.filter((_, idx) => idx !== i))
  }

  // --- Capacity ---
  function startEditCapacity() {
    setCapacityUnlimited(club.capacity === null)
    setCapacityInput(club.capacity !== null ? String(club.capacity) : '')
    setEditingCapacity(true)
  }

  async function saveCapacity() {
    const newCap = capacityUnlimited ? null : Math.max(club.memberIds.length, parseInt(capacityInput) || 1)
    await patch({ action: 'save_capacity', capacity: newCap })
    setEditingCapacity(false)
  }

  // --- Leadership ---
  async function addPosition() {
    const title = newPositionTitle.trim()
    if (!title) return
    await patch({ action: 'add_leadership_position', title })
    setNewPositionTitle('')
  }

  async function removePosition(posId: string) {
    confirm({
      title: 'Remove this position?',
      description: 'This will also remove any current appointment.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: () => patch({ action: 'remove_leadership_position', positionId: posId }),
    })
  }

  async function appointMember(posId: string) {
    const uid = appointSelections[posId]
    if (!uid) return
    await patch({ action: 'appoint_leader', positionId: posId, appointUserId: uid })
    setAppointSelections((prev) => ({ ...prev, [posId]: '' }))
  }

  async function removeAppointment(posId: string) {
    confirm({
      title: 'Remove this leader?',
      description: 'The position will become vacant.',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: () => patch({ action: 'vacate_leader', positionId: posId }),
    })
  }

  // --- Meeting times ---
  async function addMeetingTime() {
    if (!newMeetingStart || !newMeetingEnd) return
    await patch({ action: 'add_meeting_time', dayOfWeek: newMeetingDay, startTime: newMeetingStart, endTime: newMeetingEnd, location: newMeetingLocation.trim() || undefined })
    setNewMeetingLocation('')
  }

  async function removeMeetingTime(mtId: string) {
    confirm({
      title: 'Remove this meeting time?',
      confirmLabel: 'Remove',
      variant: 'danger',
      onConfirm: () => patch({ action: 'remove_meeting_time', meetingTimeId: mtId }),
    })
  }

  // --- Event permissions ---
  async function toggleEventCreator(userId: string) {
    const newIds = club.eventCreatorIds.includes(userId)
      ? club.eventCreatorIds.filter((uid) => uid !== userId)
      : [...club.eventCreatorIds, userId]
    await patch({ action: 'set_event_creators', eventCreatorIds: newIds })
  }

  // --- Events ---
  function resetEventForm() {
    setEditingEventId(null)
    setNewEventTitle(''); setNewEventDesc(''); setNewEventDate(''); setNewEventLocation(''); setNewEventPublic(true)
  }

  function toggleEventForm() {
    if (showEventForm) { setShowEventForm(false); resetEventForm() }
    else { resetEventForm(); setShowEventForm(true) }
  }

  function cancelEventForm() {
    setShowEventForm(false)
    resetEventForm()
  }

  function startEditEvent(event: ClubEvent) {
    setEditingEventId(event.id)
    setNewEventTitle(event.title)
    setNewEventDesc(event.description)
    setNewEventDate(event.date)
    setNewEventLocation(event.location ?? '')
    setNewEventPublic(event.isPublic)
    setShowEventForm(true)
  }

  async function submitEvent() {
    if (!newEventTitle.trim()) { toast.error('Event title is required'); return }
    if (!newEventDate) { toast.error('Event date is required'); return }
    if (editingEventId) {
      const ok = await patch({ action: 'edit_event', eventId: editingEventId, title: newEventTitle.trim(), description: newEventDesc.trim(), date: newEventDate, location: newEventLocation.trim() || undefined, isPublic: newEventPublic })
      if (ok) {
        cancelEventForm()
        toast.success('Event updated!')
      }
      return
    }
    const ok = await patch({ action: 'create_event', title: newEventTitle.trim(), description: newEventDesc.trim(), date: newEventDate, location: newEventLocation.trim() || undefined, isPublic: newEventPublic })
    if (ok) {
      cancelEventForm()
      toast.success('Event created!')
    }
  }

  async function deleteEvent(eventId: string) {
    confirm({
      title: 'Delete this event?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await patch({ action: 'delete_event', eventId })
        if (ok) toast.success('Event deleted')
      },
    })
  }

  // --- News ---
  async function postNews() {
    if (!newNewsTitle.trim()) { toast.error('News title is required'); return }
    if (!newNewsContent.trim()) { toast.error('News content is required'); return }
    const ok = await patch({ action: 'post_news', title: newNewsTitle.trim(), content: newNewsContent.trim(), isPinned: newNewsPinned })
    if (ok) {
      setNewNewsTitle(''); setNewNewsContent(''); setNewNewsPinned(false)
      setShowNewsForm(false)
      toast.success('News posted!')
    }
  }

  async function deleteNews(newsId: string) {
    confirm({
      title: 'Delete this news post?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await patch({ action: 'delete_news', newsId })
        if (ok) toast.success('News deleted')
      },
    })
  }

  // --- Polls ---
  function togglePollCandidate(userId: string) {
    setPollCandidateIds((prev) => prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId])
  }

  // The poll being edited (null when creating) and whether its candidates are
  // locked because voting has already started.
  const editingPoll = editingPollId ? clubPolls.find((p) => p.id === editingPollId) ?? null : null
  const editLockCandidates = !!editingPoll && editingPoll.candidates.reduce((s, c) => s + c.voteCount, 0) > 0

  function resetPollForm() {
    setPollPositionTitle(''); setPollCandidateIds([]); setEditingPollId(null); setShowPollForm(false)
  }

  function startEditPoll(poll: Poll) {
    setEditingPollId(poll.id)
    setPollPositionTitle(poll.positionTitle)
    setPollCandidateIds(poll.candidates.map((c) => c.userId))
    setShowPollForm(true)
  }

  async function createPoll() {
    if (!pollPositionTitle.trim()) { toast.error('Position title is required'); return }
    if (editingPollId) {
      if (!editLockCandidates && pollCandidateIds.length < 2) { toast.error('Select at least 2 candidates'); return }
      const ok = await patch({ action: 'edit_poll', pollId: editingPollId, positionTitle: pollPositionTitle.trim(), ...(editLockCandidates ? {} : { candidateIds: pollCandidateIds }) })
      if (ok) { resetPollForm(); toast.success('Election updated') }
      return
    }
    if (pollCandidateIds.length < 2) { toast.error('Select at least 2 candidates'); return }
    const ok = await patch({ action: 'create_poll', positionTitle: pollPositionTitle.trim(), candidateIds: pollCandidateIds })
    if (ok) {
      resetPollForm()
      toast.success('Poll created!')
    }
  }

  function deletePoll(pollId: string) {
    confirm({
      title: 'Delete this election?',
      description: 'The poll and all of its votes will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await patch({ action: 'delete_poll', pollId })
        if (ok) toast.success('Election deleted')
      },
    })
  }

  async function castVote(pollId: string, candidateUserId: string) {
    await patch({ action: 'cast_poll_vote', pollId, candidateUserId })
  }

  async function closePoll(pollId: string) {
    confirm({
      title: 'Close this poll?',
      description: 'Voting will end and results will be final.',
      confirmLabel: 'Close Poll',
      variant: 'danger',
      onConfirm: async () => {
        const ok = await patch({ action: 'close_poll', pollId })
        if (ok) toast.success('Poll closed')
      },
    })
  }

  async function appointPollWinner(pollId: string) {
    await patch({ action: 'appoint_poll_winner', pollId })
  }

  // --- QR / attendance session handlers ---

  async function generateQr() {
    let lat: number | undefined
    let lng: number | undefined
    if (qrCaptureLocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
        )
        lat = pos.coords.latitude
        lng = pos.coords.longitude
      } catch { /* location unavailable — skip */ }
    }
    const session: AttendanceSession = {
      id: `sess-${Date.now()}-${csprngHex8()}`,
      clubId: id,
      meetingDate: qrDate,
      createdBy: currentUser.id,
      expiresAt: new Date(Date.now() + qrExpiry * 60_000).toISOString(),
      maxDistanceMeters: qrDistance,
      advisorLat: lat,
      advisorLng: lng,
      recordedUserIds: [],
    }
    await saveSession(session)
    setActiveSession(session)
    setShowQrForm(false)
  }

  function getAttendUrl(session: AttendanceSession): string {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/attend?t=${session.id}`
  }

  function copyLink(session: AttendanceSession) {
    navigator.clipboard.writeText(getAttendUrl(session))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- Dues handlers ---
  function startEditDues() {
    setDuesInput((club.duesAmountCents / 100).toFixed(2))
    setEditingDues(true)
  }

  async function saveDuesAmount() {
    const dollars = parseFloat(duesInput)
    if (Number.isNaN(dollars) || dollars < 0) {
      toast.error('Enter a non-negative dollar amount')
      return
    }
    const cents = Math.round(dollars * 100)
    const ok = await patch({ action: 'set_dues_amount', amountCents: cents })
    if (ok) {
      setEditingDues(false)
      toast.success('Dues amount updated')
    }
  }

  async function toggleDuesPaid(memberId: string, currentlyPaid: boolean) {
    const ok = await patch({
      action: currentlyPaid ? 'mark_dues_unpaid' : 'mark_dues_paid',
      memberId,
    })
    if (ok) toast.success(currentlyPaid ? 'Marked unpaid' : 'Marked paid')
  }

  // --- Manual attendance handlers ---

  function setManualAttendance(userId: string, present: boolean) {
    // Compute the meeting duration once and use it for both the persisted row
    // and the rewards award. Best-effort — UI proceeds either way.
    void (async () => {
      const minutes = await computeMeetingDuration(id, manualDate)
      await upsertRecord(id, userId, manualDate, present, minutes)
      if (present) {
        try {
          await fetch('/api/rewards/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clubId: id, durationMinutes: minutes, targetUserId: userId }),
          })
        } catch (err) {
          console.error('reward award failed', err)
        }
      }
    })()
    setAttendanceRecords((prev) => {
      const next = [...prev]
      const idx = next.findIndex(
        (r) => r.clubId === id && r.userId === userId && r.meetingDate === manualDate
      )
      const rec: AttendanceRecord = {
        id: idx >= 0 ? next[idx].id : `att-manual-${Date.now()}`,
        clubId: id, userId, meetingDate: manualDate, present,
      }
      if (idx >= 0) next[idx] = rec
      else next.push(rec)
      return next
    })
  }

  // ======================== RENDER ========================

  // Hero background theme based on club tags
  const tagLower = club.tags?.[0]?.toLowerCase() ?? ''
  const heroTheme = tagLower === 'stem' || tagLower === 'engineering'
    ? { bg: 'from-blue-50 to-blue-100/40', accent: '#0058be', cluster: 'Engineering Cluster' }
    : tagLower === 'arts' || tagLower === 'performance'
    ? { bg: 'from-purple-50 to-purple-100/40', accent: '#7c3aed', cluster: 'Arts & Culture' }
    : tagLower === 'environment' || tagLower === 'community'
    ? { bg: 'from-emerald-50 to-emerald-100/40', accent: '#059669', cluster: 'Community' }
    : tagLower === 'strategy' || tagLower === 'games'
    ? { bg: 'from-amber-50 to-amber-100/40', accent: '#d97706', cluster: 'Strategy & Games' }
    : { bg: 'from-slate-50 to-slate-100/40', accent: '#0058be', cluster: 'General' }

  return (
    <div className="max-w-7xl mx-auto">

      {/* ── Back ── */}
      <Link href="/clubs" className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" />All Clubs
      </Link>

      {/* ── Confirm dialog ── */}
      <ConfirmDialog
        open={confirmDialog !== null}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant}
        onConfirm={() => confirmDialog?.onConfirm()}
        onCancel={() => setConfirmDialog(null)}
      />

      {/* ── Hero Section ── */}
      <section className={`relative overflow-hidden flex items-center px-5 sm:px-8 md:px-12 rounded-3xl mb-8 bg-gradient-to-br ${heroTheme.bg} min-h-[320px] md:min-h-[380px]`}>
        {/* Decorative pattern */}
        <div className="editorial-pattern-robotics absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent pointer-events-none" />

        {/* Edit mode overlay */}
        {editMode && (
          <div className="absolute inset-0 z-20 bg-white/97 p-5 md:p-10 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Editing Club Info</p>
            <div className="max-w-xl space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Club Image</label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {editIcon && (editIcon.startsWith('data:') || editIcon.startsWith('http')) ? (
                        <img src={editIcon} alt="Club icon" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{editIcon || '📌'}</span>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors underline"
                      >
                        Upload image
                      </button>
                      {editIcon && (editIcon.startsWith('data:') || editIcon.startsWith('http')) && (
                        <button
                          type="button"
                          onClick={() => setEditIcon('')}
                          className="block text-xs text-gray-400 hover:text-red-400 transition-colors mt-0.5"
                        >
                          Remove
                        </button>
                      )}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = (ev) => setEditIcon(ev.target?.result as string)
                          reader.readAsDataURL(file)
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Tags (comma separated)</label>
                  <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="STEM, Arts…" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4}
                  className="w-full bg-gray-50 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Social Links</label>
                <div className="space-y-1.5 mb-2">
                  {editSocialLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                      <SocialIcon platform={link.platform} />
                      <span className="text-sm text-gray-600 flex-1 truncate">{link.url}</span>
                      <button onClick={() => removeSocialLink(i)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <select value={newSocialPlatform} onChange={(e) => setNewSocialPlatform(e.target.value as SocialPlatform)}
                    className="text-sm bg-gray-50 rounded-lg px-2 py-1.5 focus:outline-none border-none">
                    {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                  <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)} placeholder="https://…" className="flex-1 h-8 text-sm" />
                  <button onClick={addSocialLink} className="text-[#0058be] hover:text-blue-800 transition-colors">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} className="bg-[#0058be] text-white rounded-xl px-6 py-2.5 text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20">
                  Save Changes
                </button>
                <button onClick={() => setEditMode(false)} className="bg-gray-100 text-gray-700 rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hero content */}
        <div className="relative z-10 max-w-2xl py-10 md:py-16 w-full min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white" style={{ background: heroTheme.accent }}>
              {heroTheme.cluster}
            </span>
            {advisor && (
              <span className="text-slate-500 text-sm font-medium">
                Advisor:{' '}
                <Link href={`/profile/${advisor.id}`} className="hover:underline font-semibold" style={{ color: heroTheme.accent }}>
                  {advisor.name}
                </Link>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 md:gap-5 mb-4 min-w-0">
            <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-2xl md:text-3xl shrink-0 overflow-hidden">
              {club.iconUrl && (club.iconUrl.startsWith('data:') || club.iconUrl.startsWith('http')) ? (
                <img src={club.iconUrl} alt={club.name} className="w-full h-full object-cover" />
              ) : (
                club.iconUrl ?? '📌'
              )}
            </div>
            <h1
              className="font-extrabold tracking-tight text-slate-900 leading-none break-words min-w-0"
              style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(1.5rem, 6vw, 3.5rem)' }}
            >
              {club.name}
            </h1>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {club.tags?.map((tag) => (
              <span key={tag} className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/80 text-gray-500 border border-gray-200/60">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-base text-gray-600 leading-relaxed font-medium mb-8 max-w-lg">
            {club.description}
          </p>

          {currentUser.role === 'student' && !isMember && !myRequest && (
            <p className="text-xs text-gray-400 mb-4">
              {club.autoAccept && !isFull ? "Auto-accepts — you'll be added immediately."
                : club.autoAccept && isFull ? 'Club is at capacity — request will be reviewed manually.'
                : 'Requests reviewed manually by the advisor.'}
            </p>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Join/Leave/Status button */}
            {currentUser.role === 'student' && (
              isMember ? (
                <button onClick={handleLeave}
                  className="px-6 py-3 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-500 bg-white transition-all">
                  Leave Club
                </button>
              ) : myRequest?.status === 'pending' ? (
                <span className="flex items-center gap-2 text-sm font-bold text-gray-400 bg-gray-100 rounded-xl px-6 py-3">
                  <ClockIcon className="w-4 h-4" />Pending Review
                </span>
              ) : myRequest?.status === 'rejected' ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-red-500 font-semibold">Request declined</span>
                  <button onClick={handleRequest}
                    className="text-sm font-bold text-white rounded-xl px-6 py-3 hover:opacity-90 transition-all shadow-lg"
                    style={{ background: heroTheme.accent, boxShadow: `0 8px 24px ${heroTheme.accent}33` }}>
                    Try Again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <button onClick={handleRequest}
                    className="text-sm font-bold text-white rounded-xl px-8 py-3 hover:opacity-90 transition-all shadow-lg"
                    style={{ background: heroTheme.accent, boxShadow: `0 8px 24px ${heroTheme.accent}33` }}>
                    Join Club
                  </button>
                  {isFull && <span className="text-[10px] text-gray-400">Club is full — manual approval</span>}
                </div>
              )
            )}

            {/* Social links */}
            {club.socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/80 text-gray-500 hover:text-[#0058be] hover:bg-white border border-gray-200/60 transition-all"
                title={PLATFORM_LABELS[link.platform]}>
                <SocialIcon platform={link.platform} />
              </a>
            ))}

            {/* Advisor controls */}
            {isAdvisor && (
              <>
                <button onClick={startEdit}
                  className="flex items-center gap-2 text-sm font-semibold bg-white/80 text-gray-600 hover:bg-white border border-gray-200/60 rounded-xl px-4 py-2.5 transition-all">
                  <Pencil className="w-4 h-4" />Edit Club
                </button>
                <button onClick={toggleAutoAccept}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    club.autoAccept ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white/80 text-gray-500 border border-gray-200/60'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${club.autoAccept ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                  Auto-accept {club.autoAccept ? 'on' : 'off'}
                </button>
                <button onClick={handleDeleteClub}
                  className="flex items-center gap-2 text-sm font-semibold bg-white/80 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-gray-200/60 rounded-xl px-4 py-2.5 transition-all">
                  <Trash2 className="w-4 h-4" />Delete Club
                </button>
              </>
            )}
          </div>

          {/* Capacity bar */}
          {club.capacity !== null && (
            <div className="mt-8 max-w-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Capacity</span>
                <span className="text-[10px] font-bold text-gray-500">{club.memberIds.length} / {club.capacity}</span>
              </div>
              <div className="w-full bg-gray-200/60 rounded-full h-1.5">
                <div className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%`,
                    background: club.memberIds.length / club.capacity >= 0.9 ? '#ef4444' : heroTheme.accent,
                  }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 mb-8">

        {/* ── Left: Leadership + Members ── */}
        <aside className="md:col-span-3 space-y-5 min-w-0">

          {/* Advisor widget */}
          {advisor && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
                Faculty Advisor
              </p>
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={advisor.name} size="md" />
                <div className="min-w-0">
                  <Link href={`/profile/${advisor.id}`}
                    className="font-bold text-slate-900 hover:text-[#0058be] transition-colors text-sm leading-tight block truncate"
                    style={{ fontFamily: 'var(--font-manrope)' }}>
                    {advisor.name}
                  </Link>
                  <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    Advisor
                  </span>
                </div>
              </div>
              <a
                href={`mailto:${advisor.email}`}
                className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-xs font-semibold text-[#0058be] hover:bg-blue-50 transition-colors border border-blue-100"
              >
                <Mail className="w-3.5 h-3.5" />
                Contact Advisor
              </a>
            </div>
          )}

          {/* Leadership positions */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-6" style={{ fontFamily: 'var(--font-manrope)' }}>
              Club Leadership
            </h3>
            {club.leadershipPositions.length === 0 && !isAdvisor && (
              <p className="text-sm text-gray-400 italic">No positions set.</p>
            )}
            <div className="space-y-5">
              {club.leadershipPositions.map((pos) => {
                const holder = pos.userId ? resolveUser(pos.userId) : null
                return (
                  <div key={pos.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400" style={{ fontFamily: 'var(--font-manrope)' }}>{pos.title}</p>
                      {isAdvisor && (
                        <button onClick={() => removePosition(pos.id)} className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {holder ? (
                      <div className="flex items-center gap-3">
                        <Avatar name={holder.name} size="sm" />
                        <Link href={`/profile/${holder.id}`} className="font-bold text-slate-900 hover:text-[#0058be] transition-colors text-sm">
                          {holder.name}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic pl-1">Vacant</p>
                    )}
                    {isAdvisor && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <select value={appointSelections[pos.id] ?? ''} onChange={(e) => setAppointSelections((prev) => ({ ...prev, [pos.id]: e.target.value }))}
                          className="text-xs bg-slate-50 rounded-lg px-2 py-1 border border-slate-200 focus:outline-none flex-1 min-w-0 text-gray-600">
                          <option value="">Select member…</option>
                          {members.map((m) => m && <option key={m.id} value={m.id}>{m.name}</option>)}
                        </select>
                        <button onClick={() => appointMember(pos.id)} disabled={!appointSelections[pos.id]}
                          className="text-xs font-bold bg-[#0058be] text-white px-2 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0 transition-colors">
                          <UserCheck className="w-3 h-3" />Set
                        </button>
                        {holder && (
                          <button onClick={() => removeAppointment(pos.id)} className="text-gray-300 hover:text-red-400 shrink-0 transition-colors">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {isAdvisor && (
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-1.5">
                <Input value={newPositionTitle} onChange={(e) => setNewPositionTitle(e.target.value)}
                  placeholder="New position…" className="h-8 text-xs flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addPosition()} />
                <button onClick={addPosition} disabled={!newPositionTitle.trim()}
                  className="h-8 w-8 flex items-center justify-center rounded-lg border bg-white text-gray-400 hover:text-[#0058be] hover:border-blue-300 disabled:opacity-40 transition-colors shrink-0">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Active members bubbles */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-5" style={{ fontFamily: 'var(--font-manrope)' }}>
              Active Members ({club.memberIds.length}{club.capacity !== null ? `/${club.capacity}` : ''})
            </h3>
            <div className="flex flex-wrap gap-2">
              {members.slice(0, 6).map((m) => m && (
                <Link key={m.id} href={`/profile/${m.id}`} title={m.name}>
                  <Avatar name={m.name} size="sm" />
                </Link>
              ))}
              {members.length > 6 && (
                <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-500">
                  +{members.length - 6}
                </div>
              )}
              {members.length === 0 && (
                <p className="text-sm text-gray-400 italic">No members yet.</p>
              )}
            </div>
          </div>
        </aside>

        {/* ── Center: News ── */}
        <ClubNews
          news={clubNews}
          canCreateContent={canCreateContent}
          isMember={isMember}
          isAdvisor={isAdvisor}
          currentUserId={currentUser.id}
          resolveUser={resolveUser}
          showForm={showNewsForm}
          setShowForm={setShowNewsForm}
          title={newNewsTitle}
          setTitle={setNewNewsTitle}
          content={newNewsContent}
          setContent={setNewNewsContent}
          pinned={newNewsPinned}
          setPinned={setNewNewsPinned}
          onPost={postNews}
          onDelete={deleteNews}
          formatTime={formatTime}
        />

        {/* ── Right: Events + Schedule ── */}
        <ClubEvents
          events={clubEvents}
          meetingTimes={club.meetingTimes}
          canCreateContent={canCreateContent}
          isAdvisor={isAdvisor}
          currentUserId={currentUser.id}
          showEventForm={showEventForm}
          editingEventId={editingEventId}
          onToggleForm={toggleEventForm}
          onCancelForm={cancelEventForm}
          newEventTitle={newEventTitle}
          setNewEventTitle={setNewEventTitle}
          newEventDesc={newEventDesc}
          setNewEventDesc={setNewEventDesc}
          newEventDate={newEventDate}
          setNewEventDate={setNewEventDate}
          newEventLocation={newEventLocation}
          setNewEventLocation={setNewEventLocation}
          newEventPublic={newEventPublic}
          setNewEventPublic={setNewEventPublic}
          onSubmitEvent={submitEvent}
          onStartEditEvent={startEditEvent}
          onDeleteEvent={deleteEvent}
          newMeetingDay={newMeetingDay}
          setNewMeetingDay={setNewMeetingDay}
          newMeetingStart={newMeetingStart}
          setNewMeetingStart={setNewMeetingStart}
          newMeetingEnd={newMeetingEnd}
          setNewMeetingEnd={setNewMeetingEnd}
          newMeetingLocation={newMeetingLocation}
          setNewMeetingLocation={setNewMeetingLocation}
          onAddMeetingTime={addMeetingTime}
          onRemoveMeetingTime={removeMeetingTime}
        />
      </div>

      {/* ── Management Sections ── */}
      <div className="space-y-5">

        {/* Members list with permissions */}
        <div className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h3 className="text-xl font-bold text-slate-900 flex flex-wrap items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
              <Users className="w-5 h-5" />All Members <span className="text-sm font-medium text-slate-400">· {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}</span>
            </h3>
            {isAdvisor && !editingCapacity && (
              <button onClick={startEditCapacity} className="text-xs font-medium text-[#0058be] hover:underline">Edit limit</button>
            )}
          </div>
          {isAdvisor && editingCapacity && (
            <div className="mb-5 flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={capacityUnlimited} onChange={(e) => setCapacityUnlimited(e.target.checked)} />
                Unlimited
              </label>
              {!capacityUnlimited && (
                <Input type="number" min={club.memberIds.length} value={capacityInput}
                  onChange={(e) => setCapacityInput(e.target.value)} className="w-24 h-8 text-sm" />
              )}
              <button onClick={saveCapacity} className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors">Save</button>
              <button onClick={() => setEditingCapacity(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
          {club.capacity !== null && (
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
              <div className="h-1.5 rounded-full bg-[#0058be] transition-all"
                style={{ width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%` }} />
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            {members.map((member) => {
              if (!member) return null
              const positions = club.leadershipPositions.filter((lp) => lp.userId === member.id)
              const canCreate = club.eventCreatorIds.includes(member.id)
              return (
                <div key={member.id} className="flex items-center justify-between gap-2 py-3 border-b border-gray-50 last:border-0 sm:pr-4">
                  <div className="flex items-center gap-2 md:gap-3 flex-wrap min-w-0">
                    <Avatar name={member.name} size="sm" />
                    <Link href={`/profile/${member.id}`} className="text-sm font-semibold text-gray-800 hover:text-[#0058be] transition-colors">
                      {member.name}
                    </Link>
                    {positions.map((pos) => (
                      <span key={pos.id} className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 flex items-center gap-1">
                        <Crown className="w-2.5 h-2.5" />{pos.title}
                      </span>
                    ))}
                    {canCreate && (
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                        Creator
                      </span>
                    )}
                  </div>
                  {isAdvisor && (
                    <button onClick={() => toggleEventCreator(member.id)}
                      title={canCreate ? 'Revoke event permission' : 'Grant event creation permission'}
                      className={`text-xs px-2 py-0.5 rounded-lg border transition-colors shrink-0 ${canCreate ? 'text-purple-600 border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'text-gray-300 border-gray-200 hover:text-purple-600 hover:border-purple-200'}`}>
                      {canCreate ? '−' : '+'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Join Requests — advisor only */}
        {isAdvisor && (
          <div className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                <ClockIcon className="w-5 h-5" />Join Requests
              </h3>
              {pendingRequests.length > 0 && (
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-[#0058be]">
                  {pendingRequests.length} pending
                </span>
              )}
            </div>
            {pendingRequests.length === 0 ? (
              <p className="text-sm text-gray-400">No pending requests.</p>
            ) : (
              <div className="space-y-0">
                {isFull && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5 mb-4">
                    Club is at capacity. Approving will exceed the limit.
                  </p>
                )}
                {pendingRequests.map((req) => {
                  const student = resolveUser(req.userId)
                  return (
                    <div key={req.id} className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={student?.name ?? '?'} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{student?.name ?? 'Unknown'}</p>
                          <p className="text-xs text-gray-400">{formatTime(req.requestedAt)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => handleReject(req.id)}
                          className="text-xs font-bold text-red-500 border border-red-200 hover:bg-red-50 rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />Decline
                        </button>
                        <button onClick={() => handleApprove(req.id)}
                          className="text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />Approve
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* My Attendance — student members only */}
        {isMember && !isAdvisor && currentUser.role === 'student' && (
          <div className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-5" style={{ fontFamily: 'var(--font-manrope)' }}>
              <CheckCircle className="w-5 h-5" />My Attendance
            </h3>
            {myAttendance.length === 0 ? (
              <p className="text-sm text-gray-400">No records yet.</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">{myPresent}/{myAttendance.length} sessions</span>
                  <span className="text-sm font-bold text-gray-800">{Math.round((myPresent / myAttendance.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
                  <div className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.round((myPresent / myAttendance.length) * 100)}%`,
                      background: myPresent / myAttendance.length >= 0.8 ? '#10b981' : myPresent / myAttendance.length >= 0.5 ? '#f59e0b' : '#ef4444',
                    }} />
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {[...myAttendance].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)).map((rec) => (
                    <div key={rec.id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{rec.meetingDate}</span>
                      <span className={`font-bold ${rec.present ? 'text-emerald-600' : 'text-red-400'}`}>
                        {rec.present ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* All Attendance — advisor only */}
        {isAdvisor && (
          <div className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100" data-tour-id="tour-attendance-section">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                <CheckCircle className="w-5 h-5" />Attendance
              </h3>
              <div className="flex gap-1.5">
                <button onClick={() => { setShowManual((v) => !v); setShowQrForm(false); setActiveSession(null) }}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg px-2.5 py-1 transition-colors">
                  Manual
                </button>
                <button onClick={() => { setShowQrForm((v) => !v); setShowManual(false); setActiveSession(null) }}
                  className="text-xs font-bold text-[#0058be] border border-blue-200 hover:bg-blue-50 rounded-lg px-2.5 py-1 flex items-center gap-1 transition-colors">
                  <QrCode className="w-3 h-3" />QR
                </button>
              </div>
            </div>

            {showQrForm && (
              <div className="mb-5 p-5 bg-gray-50 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Generate Check-in QR</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Meeting date</label>
                  <Input type="date" value={qrDate} onChange={(e) => setQrDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Expires after</label>
                  <select value={qrExpiry} onChange={(e) => setQrExpiry(Number(e.target.value))}
                    className="w-full bg-white rounded-lg px-2 py-1.5 text-xs border border-gray-200 focus:outline-none">
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={120}>2 hours</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Max distance (m, 0 = disabled)</label>
                  <Input type="number" min={0} value={qrDistance} onChange={(e) => setQrDistance(Number(e.target.value))} className="h-8 text-xs" />
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={qrCaptureLocation} onChange={(e) => setQrCaptureLocation(e.target.checked)} />
                  Capture my location now
                </label>
                <button onClick={generateQr} className="w-full text-sm font-bold bg-[#0058be] text-white rounded-xl py-2.5 hover:bg-blue-700 transition-colors">
                  Generate
                </button>
              </div>
            )}

            {activeSession && (
              <div className="mb-5 p-5 bg-blue-50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-700">{activeSession.meetingDate} check-in</p>
                  <button onClick={() => setActiveSession(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-center">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getAttendUrl(activeSession))}`}
                    alt="Attendance QR code" className="rounded-xl border-4 border-white shadow-sm" width={180} height={180} />
                </div>
                <div className="flex items-center gap-2">
                  <input readOnly value={getAttendUrl(activeSession)}
                    className="flex-1 text-xs rounded-lg px-2 py-1.5 bg-white border border-gray-100 text-gray-600 font-mono truncate" />
                  <button onClick={() => copyLink(activeSession)}
                    className="shrink-0 text-[#0058be] flex items-center gap-1 text-xs border border-blue-200 rounded-lg px-2 py-1.5 bg-white hover:bg-blue-50 transition-colors">
                    <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Expires {new Date(activeSession.expiresAt).toLocaleTimeString()}
                  {activeSession.maxDistanceMeters > 0 && ` · Within ${activeSession.maxDistanceMeters}m`}
                </p>
              </div>
            )}

            {showManual && (
              <div className="mb-5 p-5 bg-gray-50 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Manual Attendance</p>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Date</label>
                  <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} className="h-8 text-xs" />
                </div>
                {members.length === 0 ? (
                  <p className="text-xs text-gray-400">No members yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {members.map((member) => {
                      if (!member) return null
                      const rec = attendanceRecords.find((r) => r.userId === member.id && r.meetingDate === manualDate)
                      const isPresent = rec?.present
                      return (
                        <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                          <span className="text-sm text-gray-700 min-w-0 break-words">{member.name}</span>
                          <div className="flex gap-1 shrink-0">
                            <button onClick={() => setManualAttendance(member.id, true)}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${isPresent === true ? 'bg-emerald-500 text-white border-emerald-500' : 'text-gray-400 border-gray-200 hover:border-emerald-400 hover:text-emerald-600'}`}>
                              Present
                            </button>
                            <button onClick={() => setManualAttendance(member.id, false)}
                              className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${isPresent === false ? 'bg-red-400 text-white border-red-400' : 'text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500'}`}>
                              Absent
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {memberAttendance.length === 0 ? (
              <p className="text-sm text-gray-400">No members yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {memberAttendance.map(({ user, total, present }) => {
                  if (!user) return null
                  const pct = total > 0 ? Math.round((present / total) * 100) : null
                  return (
                    <div key={user.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700">{user.name}</span>
                        <span className="text-xs text-gray-400">{total === 0 ? 'No records' : `${present}/${total}`}</span>
                      </div>
                      {pct !== null && (
                        <>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                          <p className="text-[10px] text-gray-400 mt-0.5">{pct}%</p>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Member hours — advisor only. Hours auto-derived from check-ins; advisor can apply +/- adjustments. */}
        {isAdvisor && (
          <MemberHoursTable
            clubId={id}
            members={members.filter((m): m is User => Boolean(m)).map((m) => ({ id: m.id, name: m.name }))}
          />
        )}

        {/* Club Dues */}
        {(isAdvisor || (isMember && club.duesAmountCents > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                <DollarSign className="w-5 h-5" />Club Dues
              </h3>
              {isAdvisor && !editingDues && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">
                    {club.duesAmountCents > 0
                      ? `$${(club.duesAmountCents / 100).toFixed(2)} / member`
                      : 'No dues set'}
                  </span>
                  <button onClick={startEditDues}
                    className="text-xs font-bold text-[#0058be] border border-blue-200 hover:bg-blue-50 rounded-lg px-2.5 py-1 transition-colors flex items-center gap-1">
                    <Pencil className="w-3 h-3" />Edit amount
                  </button>
                </div>
              )}
            </div>

            {isAdvisor && editingDues && (
              <div className="mb-5 flex flex-wrap items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <label className="text-xs font-semibold text-gray-600">Amount per member ($)</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-400">$</span>
                  <Input type="number" min={0} step="0.01" value={duesInput}
                    onChange={(e) => setDuesInput(e.target.value)} className="w-28 h-8 text-sm" />
                </div>
                <button onClick={saveDuesAmount}
                  className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors">
                  Save
                </button>
                <button onClick={() => setEditingDues(false)} className="text-xs text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              </div>
            )}

            {/* Advisor view — full table */}
            {isAdvisor && (() => {
              if (members.length === 0) {
                return <p className="text-sm text-gray-400">No members yet.</p>
              }
              const paidById = new Map(duesPayments.filter((d) => d.paid).map((d) => [d.userId, d]))
              const paidCount = paidById.size
              const totalCollectedCents = Array.from(paidById.values()).reduce((s, d) => s + (d.amountCents || 0), 0)
              const expectedCents = club.duesAmountCents * members.length
              const pct = members.length > 0 ? Math.round((paidCount / members.length) * 100) : 0
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-1">Paid</p>
                      <p className="text-lg font-bold text-emerald-900">{paidCount} / {members.length}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 mb-1">Collected</p>
                      <p className="text-lg font-bold text-blue-900">${(totalCollectedCents / 100).toFixed(2)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Expected</p>
                      <p className="text-lg font-bold text-gray-700">${(expectedCents / 100).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5">
                    <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="space-y-0">
                    {members.map((m) => {
                      if (!m) return null
                      const payment = paidById.get(m.id)
                      const isPaid = Boolean(payment)
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar name={m.name} size="sm" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{m.name}</p>
                              {isPaid && payment?.paidAt && (
                                <p className="text-[10px] text-gray-400">Paid {formatTime(payment.paidAt)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                              {isPaid ? 'Paid' : 'Unpaid'}
                            </span>
                            <button onClick={() => toggleDuesPaid(m.id, isPaid)}
                              className={`text-xs font-bold rounded-lg px-3 py-1.5 transition-colors flex items-center gap-1 ${isPaid ? 'border border-gray-200 text-gray-600 hover:bg-gray-50' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}>
                              {isPaid ? 'Mark unpaid' : 'Mark paid'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}

            {/* Member view — own status */}
            {!isAdvisor && isMember && (() => {
              const myPayment = duesPayments.find((d) => d.userId === currentUser.id)
              const myPaid = Boolean(myPayment?.paid)
              return (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Amount</p>
                    <p className="text-2xl font-bold text-gray-900">${(club.duesAmountCents / 100).toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500 mb-1">Status</p>
                    <span className={`text-sm font-bold uppercase tracking-widest px-3 py-1 rounded-full ${myPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {myPaid ? 'Paid' : 'Unpaid'}
                    </span>
                    {myPaid && myPayment?.paidAt && (
                      <p className="text-[10px] text-gray-400 mt-1">Recorded {formatTime(myPayment.paidAt)}</p>
                    )}
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}

        {/* Elections */}
        {(isMember || isAdvisor) && (
          <div className="bg-white rounded-2xl p-5 md:p-7 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                <Vote className="w-5 h-5" />Elections
              </h3>
              {isAdvisor && (
                <button onClick={() => { if (showPollForm) { resetPollForm() } else { setEditingPollId(null); setPollPositionTitle(''); setPollCandidateIds([]); setShowPollForm(true) } }}
                  className="text-xs font-bold text-[#0058be] hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />New election
                </button>
              )}
            </div>
            {isAdvisor && showPollForm && (
              <div className="mb-5 p-5 bg-gray-50 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{editingPollId ? 'Edit Election Poll' : 'New Election Poll'}</p>
                <Input value={pollPositionTitle} onChange={(e) => setPollPositionTitle(e.target.value)} placeholder="Position title…" className="h-8 text-sm" />
                <div>
                  <p className="text-xs text-gray-500 mb-2">
                    {editLockCandidates ? 'Candidates (locked — voting has started)' : 'Candidates (select 2+)'}
                  </p>
                  {members.map((m) => m && (
                    <label key={m.id} className={`flex items-center gap-2 text-sm text-gray-700 mb-1.5 ${editLockCandidates ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input type="checkbox" disabled={editLockCandidates} checked={pollCandidateIds.includes(m.id)} onChange={() => togglePollCandidate(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={createPoll} disabled={!pollPositionTitle.trim() || (!editLockCandidates && pollCandidateIds.length < 2)}
                    className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    {editingPollId ? 'Save changes' : 'Start Election'}
                  </button>
                  <button onClick={resetPollForm} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}
            {clubPolls.length === 0 ? (
              <p className="text-sm text-gray-400">No elections yet.</p>
            ) : (
              <div className="space-y-4">
                {clubPolls.map((poll) => {
                  const totalVotes = poll.candidates.reduce((s, c) => s + c.voteCount, 0)
                  const alreadyVoted = poll.myVoteCandidateId != null
                  const winner = !poll.isOpen ? poll.candidates.reduce((a, b) => a.voteCount >= b.voteCount ? a : b) : null
                  return (
                    <div key={poll.id} className={`rounded-2xl p-5 border border-gray-100 bg-gray-50 ${!poll.isOpen ? 'opacity-70' : ''}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <p className="font-semibold text-sm text-gray-900 min-w-0 break-words" style={{ fontFamily: 'var(--font-manrope)' }}>
                          {poll.positionTitle} Election
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${poll.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                            {poll.isOpen ? 'Open' : 'Closed'}
                          </span>
                          {isAdvisor && (
                            <>
                              {poll.isOpen && <button onClick={() => appointPollWinner(poll.id)} className="text-xs font-medium text-[#0058be] hover:underline">Close & appoint</button>}
                              {poll.isOpen && <button onClick={() => closePoll(poll.id)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>}
                              <button onClick={() => startEditPoll(poll)} className="text-xs font-medium text-[#0058be] hover:underline">Edit</button>
                              <button onClick={() => deletePoll(poll.id)} className="text-xs font-medium text-red-500 hover:underline">Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                      {winner && (
                        <p className="text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2 mb-3">
                          Winner: {resolveUser(winner.userId)?.name}
                        </p>
                      )}
                      <div className="space-y-2.5">
                        {poll.candidates.map((candidate) => {
                          const user = resolveUser(candidate.userId)
                          const pct = totalVotes > 0 ? Math.round((candidate.voteCount / totalVotes) * 100) : 0
                          const hasVotedThis = poll.myVoteCandidateId === candidate.userId
                          return (
                            <div key={candidate.userId}>
                              <div className="flex items-center gap-3 mb-1">
                                {poll.isOpen && isMember && !isAdvisor && !alreadyVoted ? (
                                  <button onClick={() => castVote(poll.id, candidate.userId)}
                                    className="w-4 h-4 rounded-full border-2 border-[#0058be] shrink-0 hover:bg-blue-50 transition-colors" />
                                ) : (
                                  <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-[10px] ${hasVotedThis ? 'bg-[#0058be] text-white' : 'border border-gray-300'}`}>
                                    {hasVotedThis ? '✓' : ''}
                                  </span>
                                )}
                                <div className="flex-1 flex flex-wrap items-center justify-between gap-2 min-w-0">
                                  <span className="text-sm text-gray-700 min-w-0 break-words">{user?.name}</span>
                                  <span className="text-xs text-gray-400 shrink-0">{candidate.voteCount} vote{candidate.voteCount !== 1 ? 's' : ''}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
                                </div>
                              </div>
                              <div className="ml-7 w-full bg-gray-200 rounded-full h-1">
                                <div className="bg-[#0058be] h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {poll.isOpen && isMember && !isAdvisor && (
                        <p className="text-xs text-gray-400 mt-3">{alreadyVoted ? 'You have voted.' : 'Select a candidate to cast your vote.'}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
