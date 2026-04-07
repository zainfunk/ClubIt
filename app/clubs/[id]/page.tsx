'use client'

import { use, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import {
  CLUBS, MEMBERSHIPS, JOIN_REQUESTS, POLLS,
  getUserById, getEventsByClub, getAttendanceByClub, getNewsByClub,
} from '@/lib/mock-data'
import {
  getSessionsByClub, saveSession, upsertRecord, getRecordsByClub,
} from '@/lib/attendance-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Clock, MapPin, Globe, Calendar, Crown, CheckCircle, XCircle,
  ClockIcon, Vote, Plus, Trash2, UserCheck, Pencil, Newspaper, Camera,
  MessageCircle, Tv, Video, Link as LinkIcon, QrCode, Copy, ArrowLeft, Mail,
} from 'lucide-react'
import { User, Role, JoinRequest, LeadershipPosition, Poll, ClubEvent, ClubNews, SocialLink, SocialPlatform, MeetingTime, AttendanceRecord, AttendanceSession } from '@/types'
import Avatar from '@/components/Avatar'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const { id } = use(params)
  const { currentUser, devRole } = useMockAuth()

  // Core state — seeded from mock, merged with Supabase on mount
  const [clubs, setClubs] = useState(CLUBS)
  const [memberships, setMemberships] = useState(MEMBERSHIPS)
  const [requests, setRequests] = useState<JoinRequest[]>(JOIN_REQUESTS)
  const [polls, setPolls] = useState<Poll[]>(POLLS)
  // Users fetched from Supabase for IDs not in mock data (e.g. real Clerk accounts)
  const [supabaseUsers, setSupabaseUsers] = useState<Record<string, User>>({})

  useEffect(() => {
    // Merge Supabase memberships into local club state
    supabase.from('memberships').select('*').eq('club_id', id).then(({ data }) => {
      if (!data?.length) return
      const newMemberships = data.map((r) => ({ id: r.id, clubId: r.club_id, userId: r.user_id, joinedAt: r.joined_at }))
      setMemberships((prev) => {
        const merged = [...prev]
        for (const m of newMemberships) {
          if (!merged.find((x) => x.clubId === m.clubId && x.userId === m.userId)) merged.push(m)
        }
        return merged
      })
      setClubs((prev) => prev.map((c) => {
        if (c.id !== id) return c
        const newMemberIds = data.map((r) => r.user_id).filter((uid) => !c.memberIds.includes(uid))
        return newMemberIds.length ? { ...c, memberIds: [...c.memberIds, ...newMemberIds] } : c
      }))
      // Fetch user data for any member IDs not in mock data
      const unknownIds = data.map((r) => r.user_id).filter((uid) => !getUserById(uid))
      if (unknownIds.length > 0) {
        supabase.from('users').select('id, name, email, role').in('id', unknownIds).then(({ data: userData }) => {
          if (userData?.length) {
            setSupabaseUsers((prev) => {
              const next = { ...prev }
              for (const u of userData) next[u.id] = { id: u.id, name: u.name, email: u.email, role: u.role as Role }
              return next
            })
          }
        })
      }
    })
    // Merge Supabase join requests
    supabase.from('join_requests').select('*').eq('club_id', id).then(({ data }) => {
      if (!data?.length) return
      const newRequests = data.map((r) => ({ id: r.id, clubId: r.club_id, userId: r.user_id, requestedAt: r.requested_at, status: r.status }))
      setRequests((prev) => {
        const merged = [...prev]
        for (const r of newRequests) {
          if (!merged.find((x) => x.id === r.id)) merged.push(r)
        }
        return merged
      })
      // Fetch user data for any requester IDs not in mock data
      const unknownIds = data.map((r) => r.user_id).filter((uid) => !getUserById(uid))
      if (unknownIds.length > 0) {
        supabase.from('users').select('id, name, email, role').in('id', unknownIds).then(({ data: userData }) => {
          if (userData?.length) {
            setSupabaseUsers((prev) => {
              const next = { ...prev }
              for (const u of userData) next[u.id] = { id: u.id, name: u.name, email: u.email, role: u.role as Role }
              return next
            })
          }
        })
      }
    })
  }, [id])
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>(() => getEventsByClub(id))
  const [clubNews, setClubNews] = useState<ClubNews[]>(() => getNewsByClub(id))

  // Load club structural data from Supabase on mount (overrides mock defaults)
  useEffect(() => {
    supabase.from('clubs').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) setClubs((prev) => prev.map((c) => c.id !== id ? c : {
        ...c,
        autoAccept: data.auto_accept ?? c.autoAccept,
        capacity: data.capacity ?? c.capacity,
        iconUrl: data.icon_url ?? c.iconUrl,
        description: data.description ?? c.description,
        tags: data.tags ?? c.tags,
        eventCreatorIds: data.event_creator_ids ?? c.eventCreatorIds,
      }))
    })
    supabase.from('leadership_positions').select('*').eq('club_id', id).then(({ data }) => {
      if (data?.length) setClubs((prev) => prev.map((c) => c.id !== id ? c : {
        ...c, leadershipPositions: data.map((p) => ({ id: p.id, title: p.title, userId: p.user_id ?? undefined })),
      }))
    })
    supabase.from('club_social_links').select('*').eq('club_id', id).then(({ data }) => {
      if (data) setClubs((prev) => prev.map((c) => c.id !== id ? c : {
        ...c, socialLinks: data.map((sl) => ({ platform: sl.platform as SocialLink['platform'], url: sl.url })),
      }))
    })
    supabase.from('meeting_times').select('*').eq('club_id', id).then(({ data }) => {
      if (data?.length) setClubs((prev) => prev.map((c) => c.id !== id ? c : {
        ...c, meetingTimes: data.map((mt) => ({
          id: mt.id, dayOfWeek: mt.day_of_week as MeetingTime['dayOfWeek'],
          startTime: mt.start_time, endTime: mt.end_time, location: mt.location ?? undefined,
        })),
      }))
    })
    supabase.from('events').select('*').eq('club_id', id).then(({ data }) => {
      if (data) setClubEvents(data.map((e) => ({
        id: e.id, clubId: e.club_id, title: e.title, description: e.description ?? '',
        date: e.date, location: e.location ?? undefined, isPublic: e.is_public, createdBy: e.created_by,
      })).sort((a, b) => a.date.localeCompare(b.date)))
    })
    supabase.from('club_news').select('*').eq('club_id', id).then(({ data }) => {
      if (data) setClubNews(data.map((n) => ({
        id: n.id, clubId: n.club_id, title: n.title, content: n.content,
        authorId: n.author_id, createdAt: n.created_at, isPinned: n.is_pinned,
      })).sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }))
    })
    supabase.from('polls').select('*, poll_candidates(*), poll_votes(*)').eq('club_id', id).then(({ data }) => {
      if (data) setPolls(data.map((p) => ({
        id: p.id, clubId: p.club_id, positionTitle: p.position_title,
        createdAt: p.created_at, isOpen: p.is_open,
        candidates: (p.poll_candidates as {user_id: string}[]).map((c) => ({
          userId: c.user_id,
          votes: (p.poll_votes as {candidate_user_id: string; voter_user_id: string}[])
            .filter((v) => v.candidate_user_id === c.user_id)
            .map((v) => v.voter_user_id),
        })),
      })))
    })
  }, [id])

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

  // Event creation
  const [showEventForm, setShowEventForm] = useState(false)
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

  // Poll creation
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollPositionTitle, setPollPositionTitle] = useState('')
  const [pollCandidateIds, setPollCandidateIds] = useState<string[]>([])

  // Attendance state (merges static mock data + Supabase records)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(getAttendanceByClub(id))

  useEffect(() => {
    getRecordsByClub(id).then((stored) => {
      setAttendanceRecords((prev) => {
        const merged = [...prev]
        for (const r of stored) {
          const idx = merged.findIndex(
            (m) => m.clubId === r.clubId && m.userId === r.userId && m.meetingDate === r.meetingDate
          )
          if (idx >= 0) merged[idx] = r
          else merged.push(r)
        }
        return merged
      })
    })
  }, [id])

  // QR / attendance session state (advisor)
  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  useEffect(() => { getSessionsByClub(id).then(setSessions) }, [id])
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

  const foundClub = clubs.find((c) => c.id === id)
  if (!foundClub) notFound()
  const club = foundClub!

  function resolveUser(userId: string): User | undefined {
    return getUserById(userId) ?? supabaseUsers[userId]
  }

  const advisor = resolveUser(club.advisorId)
  const members = club.memberIds.map((mid) => resolveUser(mid)).filter(Boolean)

  const isAdvisor = currentUser.role === 'advisor' && (devRole === 'advisor' || club.advisorId === currentUser.id)
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
    const autoApprove = club.autoAccept && !isFull
    const reqId = `req-${Date.now()}`
    const membershipId = `m-${Date.now()}`
    const now = new Date().toISOString()
    const status = autoApprove ? 'approved' : 'pending'

    await supabase.from('join_requests').insert({ id: reqId, club_id: id, user_id: currentUser.id, requested_at: now, status })
    setRequests((prev) => [...prev, { id: reqId, clubId: id, userId: currentUser.id, requestedAt: now, status }])

    if (autoApprove) {
      await supabase.from('memberships').insert({ id: membershipId, club_id: id, user_id: currentUser.id, joined_at: now.split('T')[0] })
      setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, currentUser.id] } : c))
      setMemberships((prev) => [...prev, { id: membershipId, clubId: id, userId: currentUser.id, joinedAt: now.split('T')[0] }])
    }
  }

  async function handleLeave() {
    await supabase.from('memberships').delete().eq('club_id', id).eq('user_id', currentUser.id)
    await supabase.from('join_requests').delete().eq('club_id', id).eq('user_id', currentUser.id)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: c.memberIds.filter((mid) => mid !== currentUser.id) } : c))
    setMemberships((prev) => prev.filter((m) => !(m.clubId === id && m.userId === currentUser.id)))
    setRequests((prev) => prev.filter((r) => !(r.clubId === id && r.userId === currentUser.id)))
  }

  async function handleApprove(requestId: string) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    const membershipId = `m-${Date.now()}`
    const joinedAt = new Date().toISOString().split('T')[0]
    await supabase.from('join_requests').update({ status: 'approved' }).eq('id', requestId)
    await supabase.from('memberships').insert({ id: membershipId, club_id: id, user_id: req.userId, joined_at: joinedAt })
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'approved' } : r))
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, req.userId] } : c))
    setMemberships((prev) => [...prev, { id: membershipId, clubId: id, userId: req.userId, joinedAt }])
  }

  async function handleReject(requestId: string) {
    await supabase.from('join_requests').update({ status: 'rejected' }).eq('id', requestId)
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'rejected' } : r))
  }

  async function toggleAutoAccept() {
    const newVal = !club.autoAccept
    await supabase.from('clubs').update({ auto_accept: newVal }).eq('id', id)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, autoAccept: newVal } : c))
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
    await supabase.from('clubs').update({ icon_url: newIcon, description: newDesc, tags: newTags }).eq('id', id)
    await supabase.from('club_social_links').delete().eq('club_id', id)
    if (editSocialLinks.length > 0) {
      await supabase.from('club_social_links').insert(editSocialLinks.map((sl) => ({ club_id: id, platform: sl.platform, url: sl.url })))
    }
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c, iconUrl: newIcon, description: newDesc, tags: newTags, socialLinks: editSocialLinks,
    } : c))
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
    await supabase.from('clubs').update({ capacity: newCap }).eq('id', id)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, capacity: newCap } : c))
    setEditingCapacity(false)
  }

  // --- Leadership ---
  async function addPosition() {
    const title = newPositionTitle.trim()
    if (!title) return
    const posId = `lp-${Date.now()}`
    const newPos: LeadershipPosition = { id: posId, title, userId: undefined }
    await supabase.from('leadership_positions').insert({ id: posId, club_id: id, title, user_id: null })
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: [...c.leadershipPositions, newPos] } : c))
    setNewPositionTitle('')
  }

  async function removePosition(posId: string) {
    await supabase.from('leadership_positions').delete().eq('id', posId)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.filter((p) => p.id !== posId) } : c))
  }

  async function appointMember(posId: string) {
    const userId = appointSelections[posId]
    if (!userId) return
    await supabase.from('leadership_positions').update({ user_id: userId }).eq('id', posId)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId } : p) } : c))
    setAppointSelections((prev) => ({ ...prev, [posId]: '' }))
  }

  async function removeAppointment(posId: string) {
    await supabase.from('leadership_positions').update({ user_id: null }).eq('id', posId)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId: undefined } : p) } : c))
  }

  // --- Meeting times ---
  async function addMeetingTime() {
    if (!newMeetingStart || !newMeetingEnd) return
    const mtId = `mt-${Date.now()}`
    const newMt: MeetingTime = {
      id: mtId, dayOfWeek: newMeetingDay as MeetingTime['dayOfWeek'],
      startTime: newMeetingStart, endTime: newMeetingEnd,
      location: newMeetingLocation.trim() || undefined,
    }
    await supabase.from('meeting_times').insert({
      id: mtId, club_id: id, day_of_week: newMeetingDay,
      start_time: newMeetingStart, end_time: newMeetingEnd,
      location: newMeetingLocation.trim() || null,
    })
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: [...c.meetingTimes, newMt] } : c))
    setNewMeetingLocation('')
  }

  async function removeMeetingTime(mtId: string) {
    await supabase.from('meeting_times').delete().eq('id', mtId)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: c.meetingTimes.filter((m) => m.id !== mtId) } : c))
  }

  // --- Event permissions ---
  async function toggleEventCreator(userId: string) {
    const newIds = club.eventCreatorIds.includes(userId)
      ? club.eventCreatorIds.filter((uid) => uid !== userId)
      : [...club.eventCreatorIds, userId]
    await supabase.from('clubs').update({ event_creator_ids: newIds }).eq('id', id)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, eventCreatorIds: newIds } : c))
  }

  // --- Events ---
  async function createEvent() {
    if (!newEventTitle.trim() || !newEventDate) return
    const ev: ClubEvent = {
      id: `event-${Date.now()}`, clubId: id,
      title: newEventTitle.trim(), description: newEventDesc.trim(),
      date: newEventDate, location: newEventLocation.trim() || undefined,
      isPublic: newEventPublic, createdBy: currentUser.id,
    }
    await supabase.from('events').insert({
      id: ev.id, club_id: id, title: ev.title, description: ev.description,
      date: ev.date, location: ev.location ?? null, is_public: ev.isPublic, created_by: ev.createdBy,
    })
    setClubEvents((prev) => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date)))
    setNewEventTitle(''); setNewEventDesc(''); setNewEventDate(''); setNewEventLocation(''); setNewEventPublic(true)
    setShowEventForm(false)
  }

  async function deleteEvent(eventId: string) {
    await supabase.from('events').delete().eq('id', eventId)
    setClubEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  // --- News ---
  async function postNews() {
    if (!newNewsTitle.trim() || !newNewsContent.trim()) return
    const news: ClubNews = {
      id: `news-${Date.now()}`, clubId: id,
      title: newNewsTitle.trim(), content: newNewsContent.trim(),
      authorId: currentUser.id, createdAt: new Date().toISOString(), isPinned: newNewsPinned,
    }
    await supabase.from('club_news').insert({
      id: news.id, club_id: id, title: news.title, content: news.content,
      author_id: news.authorId, created_at: news.createdAt, is_pinned: news.isPinned,
    })
    setClubNews((prev) => {
      const updated = [...prev, news].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
      return updated
    })
    setNewNewsTitle(''); setNewNewsContent(''); setNewNewsPinned(false)
    setShowNewsForm(false)
  }

  async function deleteNews(newsId: string) {
    await supabase.from('club_news').delete().eq('id', newsId)
    setClubNews((prev) => prev.filter((n) => n.id !== newsId))
  }

  // --- Polls ---
  function togglePollCandidate(userId: string) {
    setPollCandidateIds((prev) => prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId])
  }

  async function createPoll() {
    if (!pollPositionTitle.trim() || pollCandidateIds.length < 2) return
    const pollId = `poll-${Date.now()}`
    const newPoll: Poll = {
      id: pollId, clubId: id, positionTitle: pollPositionTitle.trim(),
      candidates: pollCandidateIds.map((uid) => ({ userId: uid, votes: [] })),
      createdAt: new Date().toISOString(), isOpen: true,
    }
    await supabase.from('polls').insert({ id: pollId, club_id: id, position_title: newPoll.positionTitle, created_at: newPoll.createdAt, is_open: true })
    await supabase.from('poll_candidates').insert(pollCandidateIds.map((uid) => ({ poll_id: pollId, user_id: uid })))
    setPolls((prev) => [...prev, newPoll])
    setPollPositionTitle(''); setPollCandidateIds([]); setShowPollForm(false)
  }

  async function castVote(pollId: string, candidateUserId: string) {
    await supabase.from('poll_votes').insert({ poll_id: pollId, candidate_user_id: candidateUserId, voter_user_id: currentUser.id })
    setPolls((prev) => prev.map((p) => p.id === pollId ? {
      ...p, candidates: p.candidates.map((c) => c.userId === candidateUserId ? { ...c, votes: [...c.votes, currentUser.id] } : c),
    } : p))
  }

  async function closePoll(pollId: string) {
    await supabase.from('polls').update({ is_open: false }).eq('id', pollId)
    setPolls((prev) => prev.map((p) => p.id === pollId ? { ...p, isOpen: false } : p))
  }

  function appointPollWinner(pollId: string) {
    const poll = polls.find((p) => p.id === pollId)
    if (!poll) return
    const winner = poll.candidates.reduce((a, b) => a.votes.length >= b.votes.length ? a : b)
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c, leadershipPositions: c.leadershipPositions.map((p) =>
        p.title.toLowerCase() === poll.positionTitle.toLowerCase() ? { ...p, userId: winner.userId } : p
      ),
    } : c))
    closePoll(pollId)
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
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      clubId: id,
      meetingDate: qrDate,
      createdBy: currentUser.id,
      expiresAt: new Date(Date.now() + qrExpiry * 60_000).toISOString(),
      maxDistanceMeters: qrDistance,
      advisorLat: lat,
      advisorLng: lng,
      recordedUserIds: [],
    }
    saveSession(session)
    setSessions((prev) => [...prev, session])
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

  // --- Manual attendance handlers ---

  function setManualAttendance(userId: string, present: boolean) {
    upsertRecord(id, userId, manualDate, present) // async write, fire-and-forget
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

      {/* ── Hero Section ── */}
      <section className={`relative overflow-hidden flex items-center px-12 rounded-3xl mb-8 bg-gradient-to-br ${heroTheme.bg}`} style={{ minHeight: '380px' }}>
        {/* Decorative pattern */}
        <div className="editorial-pattern-robotics absolute inset-0 pointer-events-none" style={{ opacity: 0.04 }} />
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/60 to-transparent pointer-events-none" />

        {/* Edit mode overlay */}
        {editMode && (
          <div className="absolute inset-0 z-20 bg-white/97 p-10 overflow-y-auto">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Editing Club Info</p>
            <div className="max-w-xl space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
        <div className="relative z-10 max-w-2xl py-16">
          <div className="flex items-center gap-4 mb-6">
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

          <div className="flex items-center gap-5 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center text-3xl shrink-0 overflow-hidden">
              {club.iconUrl && (club.iconUrl.startsWith('data:') || club.iconUrl.startsWith('http')) ? (
                <img src={club.iconUrl} alt={club.name} className="w-full h-full object-cover" />
              ) : (
                club.iconUrl ?? '📌'
              )}
            </div>
            <h1
              className="font-extrabold tracking-tight text-slate-900 leading-none"
              style={{ fontFamily: 'var(--font-manrope)', fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}
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
      <div className="grid grid-cols-12 gap-8 mb-8">

        {/* ── Left: Leadership + Members ── */}
        <aside className="col-span-3 space-y-5">

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
        <section className="col-span-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
              News
            </h2>
            {canCreateContent && (
              <button onClick={() => setShowNewsForm((v) => !v)}
                className="text-[#0058be] font-bold text-sm hover:underline flex items-center gap-1">
                <Plus className="w-4 h-4" />Post Update
              </button>
            )}
          </div>

          {/* News creation form */}
          {canCreateContent && showNewsForm && (
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>New Post</h3>
              <Input value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} placeholder="Title…" />
              <textarea value={newNewsContent} onChange={(e) => setNewNewsContent(e.target.value)}
                placeholder="Write your update…" rows={4}
                className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={newNewsPinned} onChange={(e) => setNewNewsPinned(e.target.checked)} />
                  Pin to top
                </label>
                <div className="flex gap-2">
                  <button onClick={postNews} disabled={!newNewsTitle.trim() || !newNewsContent.trim()}
                    className="text-xs font-bold bg-[#0058be] text-white rounded-xl px-5 py-2 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Post
                  </button>
                  <button onClick={() => setShowNewsForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {!(isMember || isAdvisor) && (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
              <p className="text-gray-400 text-sm">Join the club to see updates.</p>
            </div>
          )}

          {(isMember || isAdvisor) && clubNews.length === 0 && !showNewsForm && (
            <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center">
              <p className="text-gray-400 text-sm">No posts yet.</p>
            </div>
          )}

          {(isMember || isAdvisor) && clubNews.map((news) => {
            const author = resolveUser(news.authorId)
            const canDelete = isAdvisor || news.authorId === currentUser.id
            if (news.isPinned) {
              return (
                <div key={news.id} className="bg-[#0058be]/5 rounded-3xl p-8 border border-[#0058be]/10 relative overflow-hidden">
                  <div className="absolute top-4 right-4">
                    <Newspaper className="w-4 h-4 text-[#0058be]" />
                  </div>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="w-8 h-8 rounded-full bg-[#0058be] flex items-center justify-center text-white shrink-0">
                      <Newspaper className="w-4 h-4" />
                    </span>
                    <span className="text-[#0058be] font-bold text-xs uppercase tracking-widest">Pinned Update</span>
                  </div>
                  <h3 className="font-bold text-xl text-slate-900 mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                    {news.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed mb-6">{news.content}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs font-medium">
                      {author?.name} · {formatTime(news.createdAt)}
                    </span>
                    {canDelete && (
                      <button onClick={() => deleteNews(news.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            }
            return (
              <div key={news.id} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:-translate-y-1 transition-transform">
                <div className="flex items-center gap-2 mb-4 text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">General Update</span>
                </div>
                <h3 className="font-bold text-xl text-slate-900 mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>
                  {news.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">{news.content}</p>
                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-slate-400 text-xs font-medium">
                    {author?.name} · {formatTime(news.createdAt)}
                  </span>
                  {canDelete && (
                    <button onClick={() => deleteNews(news.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* ── Right: Events + Schedule ── */}
        <section className="col-span-3 space-y-5" data-tour-id="tour-events-section">
          {/* Upcoming Events */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
                Upcoming Events
              </h3>
              {canCreateContent && (
                <button onClick={() => setShowEventForm((v) => !v)}
                  className="text-[#0058be] font-bold text-xs hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />Add
                </button>
              )}
            </div>

            {/* Event creation form */}
            {canCreateContent && showEventForm && (
              <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Event</p>
                <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Event title…" className="h-8 text-sm" />
                <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Description…" rows={2}
                  className="w-full bg-gray-50 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none border border-gray-100" />
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Date</label>
                    <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Location</label>
                    <Input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="Room 204…" className="h-8 text-sm" />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={newEventPublic} onChange={(e) => setNewEventPublic(e.target.checked)} />
                  Public event
                </label>
                <div className="flex gap-2">
                  <button onClick={createEvent} disabled={!newEventTitle.trim() || !newEventDate}
                    className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 transition-colors">
                    Create
                  </button>
                  <button onClick={() => setShowEventForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}

            {clubEvents.length === 0 && !showEventForm && (
              <p className="text-sm text-gray-400 italic">No events scheduled.</p>
            )}

            <div className="space-y-5">
              {clubEvents.map((event) => {
                const date = new Date(event.date + 'T00:00:00')
                const canDelete = isAdvisor || event.createdBy === currentUser.id
                return (
                  <div key={event.id} className="flex gap-4 group">
                    <div className="w-14 h-16 flex-shrink-0 date-spine-gradient rounded-2xl flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-[#0058be] uppercase leading-none">
                        {date.toLocaleString('en', { month: 'short' })}
                      </span>
                      <span className="text-xl font-black text-[#0058be] leading-none mt-1">
                        {date.getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-slate-900 group-hover:text-[#0058be] transition-colors leading-snug text-sm">
                          {event.title}
                        </h4>
                        {canDelete && (
                          <button onClick={() => deleteEvent(event.id)}
                            className="text-gray-200 hover:text-red-400 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      {event.location && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{event.location}
                        </p>
                      )}
                      {!event.isPublic && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                          Members only
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Schedule */}
          {(club.meetingTimes.length > 0 || isAdvisor) && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 mb-5" style={{ fontFamily: 'var(--font-manrope)' }}>
                Schedule
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Weekly Times</p>
              <div className="space-y-3">
                {club.meetingTimes.map((mt) => {
                  const fmt = (t: string) => {
                    const [h, m] = t.split(':').map(Number)
                    const ampm = h >= 12 ? 'PM' : 'AM'
                    const h12 = h % 12 || 12
                    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
                  }
                  return (
                  <div key={mt.id} className="group/mt flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{DAY_NAMES[mt.dayOfWeek]}s &nbsp;·&nbsp; {fmt(mt.startTime)} – {fmt(mt.endTime)}</p>
                      {mt.location && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <p className="text-xs text-slate-500">{mt.location}</p>
                        </div>
                      )}
                    </div>
                    {isAdvisor && (
                      <button onClick={() => removeMeetingTime(mt.id)}
                        className="text-gray-200 hover:text-red-400 opacity-0 group-hover/mt:opacity-100 transition-all shrink-0 mt-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  )
                })}

                {club.meetingTimes.length === 0 && (
                  <p className="text-slate-400 text-sm italic">No schedule set.</p>
                )}

                {isAdvisor && (
                  <div className="pt-4 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Add time</p>
                    <select value={newMeetingDay} onChange={(e) => setNewMeetingDay(Number(e.target.value))}
                      className="w-full text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none">
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}s</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input type="time" value={newMeetingStart} onChange={(e) => setNewMeetingStart(e.target.value)}
                        className="text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none" />
                      <input type="time" value={newMeetingEnd} onChange={(e) => setNewMeetingEnd(e.target.value)}
                        className="text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none" />
                    </div>
                    <input value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)}
                      placeholder="Location (optional)"
                      className="w-full text-xs bg-slate-50 text-slate-700 rounded-lg px-2 py-1.5 border border-slate-200 focus:outline-none placeholder:text-slate-400" />
                    <button onClick={addMeetingTime}
                      className="w-full py-2 bg-[#0058be] hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors">
                      Add
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Management Sections ── */}
      <div className="space-y-5">

        {/* Members list with permissions */}
        <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
              <Users className="w-5 h-5" />All Members <span className="text-sm font-medium text-slate-400">· {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}</span>
            </h3>
            {isAdvisor && !editingCapacity && (
              <button onClick={startEditCapacity} className="text-xs font-medium text-[#0058be] hover:underline">Edit limit</button>
            )}
          </div>
          {isAdvisor && editingCapacity && (
            <div className="mb-5 flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
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
                <div key={member.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 pr-4">
                  <div className="flex items-center gap-3 flex-wrap">
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
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
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
                    <div key={req.id} className="flex items-center justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <Avatar name={student?.name ?? '?'} size="sm" />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{student?.name ?? 'Unknown'}</p>
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
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
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
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100" data-tour-id="tour-attendance-section">
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
                        <div key={member.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-gray-700">{member.name}</span>
                          <div className="flex gap-1">
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

        {/* Elections */}
        {(isMember || isAdvisor) && (
          <div className="bg-white rounded-2xl p-7 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
                <Vote className="w-5 h-5" />Elections
              </h3>
              {isAdvisor && (
                <button onClick={() => setShowPollForm((v) => !v)}
                  className="text-xs font-bold text-[#0058be] hover:underline flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />New election
                </button>
              )}
            </div>
            {isAdvisor && showPollForm && (
              <div className="mb-5 p-5 bg-gray-50 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">New Election Poll</p>
                <Input value={pollPositionTitle} onChange={(e) => setPollPositionTitle(e.target.value)} placeholder="Position title…" className="h-8 text-sm" />
                <div>
                  <p className="text-xs text-gray-500 mb-2">Candidates (select 2+)</p>
                  {members.map((m) => m && (
                    <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-1.5">
                      <input type="checkbox" checked={pollCandidateIds.includes(m.id)} onChange={() => togglePollCandidate(m.id)} />
                      {m.name}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={createPoll} disabled={!pollPositionTitle.trim() || pollCandidateIds.length < 2}
                    className="text-xs font-bold bg-[#0058be] text-white rounded-lg px-4 py-1.5 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    Start Election
                  </button>
                  <button onClick={() => setShowPollForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                </div>
              </div>
            )}
            {clubPolls.length === 0 ? (
              <p className="text-sm text-gray-400">No elections yet.</p>
            ) : (
              <div className="space-y-4">
                {clubPolls.map((poll) => {
                  const totalVotes = poll.candidates.reduce((s, c) => s + c.votes.length, 0)
                  const alreadyVoted = poll.candidates.some((c) => c.votes.includes(currentUser.id))
                  const winner = !poll.isOpen ? poll.candidates.reduce((a, b) => a.votes.length >= b.votes.length ? a : b) : null
                  return (
                    <div key={poll.id} className={`rounded-2xl p-5 border border-gray-100 bg-gray-50 ${!poll.isOpen ? 'opacity-70' : ''}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-sm text-gray-900" style={{ fontFamily: 'var(--font-manrope)' }}>
                          {poll.positionTitle} Election
                        </p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${poll.isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                            {poll.isOpen ? 'Open' : 'Closed'}
                          </span>
                          {isAdvisor && poll.isOpen && (
                            <>
                              <button onClick={() => appointPollWinner(poll.id)} className="text-xs font-medium text-[#0058be] hover:underline">Close & appoint</button>
                              <button onClick={() => closePoll(poll.id)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
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
                          const pct = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0
                          const hasVotedThis = candidate.votes.includes(currentUser.id)
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
                                <div className="flex-1 flex items-center justify-between">
                                  <span className="text-sm text-gray-700">{user?.name}</span>
                                  <span className="text-xs text-gray-400">{candidate.votes.length} vote{candidate.votes.length !== 1 ? 's' : ''}{totalVotes > 0 ? ` · ${pct}%` : ''}</span>
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