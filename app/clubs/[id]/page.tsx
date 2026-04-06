'use client'

import { use, useState } from 'react'
import { notFound } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import {
  CLUBS, MEMBERSHIPS, JOIN_REQUESTS, POLLS,
  getUserById, getEventsByClub, getAttendanceByClub, getNewsByClub, USERS,
} from '@/lib/mock-data'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, Clock, MapPin, Globe, Calendar, Crown, CheckCircle, XCircle,
  ClockIcon, Vote, Plus, Trash2, UserCheck, Pencil, Newspaper, Camera,
  MessageCircle, Tv, Video, Link as LinkIcon,
} from 'lucide-react'
import { JoinRequest, LeadershipPosition, Poll, ClubEvent, ClubNews, SocialLink, SocialPlatform, MeetingTime } from '@/types'

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
  const { currentUser } = useMockAuth()

  // Core state
  const [clubs, setClubs] = useState(CLUBS)
  const [memberships, setMemberships] = useState(MEMBERSHIPS)
  const [requests, setRequests] = useState<JoinRequest[]>(JOIN_REQUESTS)
  const [polls, setPolls] = useState<Poll[]>(POLLS)
  const [clubEvents, setClubEvents] = useState<ClubEvent[]>(() => getEventsByClub(id))
  const [clubNews, setClubNews] = useState<ClubNews[]>(() => getNewsByClub(id))

  // Edit mode for club header info (advisor)
  const [editMode, setEditMode] = useState(false)
  const [editIcon, setEditIcon] = useState('')
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

  const club = clubs.find((c) => c.id === id)
  if (!club) notFound()

  const advisor = getUserById(club.advisorId)
  const members = club.memberIds.map((mid) => getUserById(mid)).filter(Boolean)
  const attendanceRecords = getAttendanceByClub(club.id)

  const isMember = club.memberIds.includes(currentUser.id)
  const isAdvisor = currentUser.role === 'advisor' && club.advisorId === currentUser.id
  const canCreateContent = isAdvisor || club.eventCreatorIds.includes(currentUser.id)
  const isFull = club.capacity !== null && club.memberIds.length >= club.capacity

  const myRequest = requests.find((r) => r.clubId === id && r.userId === currentUser.id)
  const pendingRequests = requests
    .filter((r) => r.clubId === id && r.status === 'pending')
    .sort((a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime())

  const clubPolls = polls.filter((p) => p.clubId === id)

  // Per-member attendance
  const memberAttendance = club.memberIds.map((mid) => {
    const user = getUserById(mid)
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
  function handleRequest() {
    const autoApprove = club.autoAccept && !isFull
    const newRequest: JoinRequest = {
      id: `req-${Date.now()}`, clubId: id, userId: currentUser.id,
      requestedAt: new Date().toISOString(), status: autoApprove ? 'approved' : 'pending',
    }
    setRequests((prev) => [...prev, newRequest])
    if (autoApprove) {
      setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, currentUser.id] } : c))
      setMemberships((prev) => [...prev, { id: `m-${Date.now()}`, clubId: id, userId: currentUser.id, joinedAt: new Date().toISOString().split('T')[0] }])
    }
  }

  function handleLeave() {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: c.memberIds.filter((mid) => mid !== currentUser.id) } : c))
    setMemberships((prev) => prev.filter((m) => !(m.clubId === id && m.userId === currentUser.id)))
    setRequests((prev) => prev.filter((r) => !(r.clubId === id && r.userId === currentUser.id)))
  }

  function handleApprove(requestId: string) {
    const req = requests.find((r) => r.id === requestId)
    if (!req) return
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'approved' } : r))
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, memberIds: [...c.memberIds, req.userId] } : c))
    setMemberships((prev) => [...prev, { id: `m-${Date.now()}`, clubId: id, userId: req.userId, joinedAt: new Date().toISOString().split('T')[0] }])
  }

  function handleReject(requestId: string) {
    setRequests((prev) => prev.map((r) => r.id === requestId ? { ...r, status: 'rejected' } : r))
  }

  function toggleAutoAccept() {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, autoAccept: !c.autoAccept } : c))
  }

  // --- Edit mode ---
  function startEdit() {
    setEditIcon(club.iconUrl ?? '')
    setEditDescription(club.description)
    setEditTags(club.tags?.join(', ') ?? '')
    setEditSocialLinks([...club.socialLinks])
    setEditMode(true)
  }

  function saveEdit() {
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c,
      iconUrl: editIcon.trim() || c.iconUrl,
      description: editDescription.trim() || c.description,
      tags: editTags ? editTags.split(',').map((t) => t.trim()).filter(Boolean) : c.tags,
      socialLinks: editSocialLinks,
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

  function saveCapacity() {
    const newCap = capacityUnlimited ? null : Math.max(club.memberIds.length, parseInt(capacityInput) || 1)
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, capacity: newCap } : c))
    setEditingCapacity(false)
  }

  // --- Leadership ---
  function addPosition() {
    const title = newPositionTitle.trim()
    if (!title) return
    const newPos: LeadershipPosition = { id: `lp-${Date.now()}`, title, userId: undefined }
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: [...c.leadershipPositions, newPos] } : c))
    setNewPositionTitle('')
  }

  function removePosition(posId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.filter((p) => p.id !== posId) } : c))
  }

  function appointMember(posId: string) {
    const userId = appointSelections[posId]
    if (!userId) return
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId } : p) } : c))
    setAppointSelections((prev) => ({ ...prev, [posId]: '' }))
  }

  function removeAppointment(posId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, leadershipPositions: c.leadershipPositions.map((p) => p.id === posId ? { ...p, userId: undefined } : p) } : c))
  }

  // --- Meeting times ---
  function addMeetingTime() {
    if (!newMeetingStart || !newMeetingEnd) return
    const newMt: MeetingTime = {
      id: `mt-${Date.now()}`, dayOfWeek: newMeetingDay as MeetingTime['dayOfWeek'],
      startTime: newMeetingStart, endTime: newMeetingEnd,
      location: newMeetingLocation.trim() || undefined,
    }
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: [...c.meetingTimes, newMt] } : c))
    setNewMeetingLocation('')
  }

  function removeMeetingTime(mtId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? { ...c, meetingTimes: c.meetingTimes.filter((m) => m.id !== mtId) } : c))
  }

  // --- Event permissions ---
  function toggleEventCreator(userId: string) {
    setClubs((prev) => prev.map((c) => c.id === id ? {
      ...c,
      eventCreatorIds: c.eventCreatorIds.includes(userId)
        ? c.eventCreatorIds.filter((uid) => uid !== userId)
        : [...c.eventCreatorIds, userId],
    } : c))
  }

  // --- Events ---
  function createEvent() {
    if (!newEventTitle.trim() || !newEventDate) return
    const ev: ClubEvent = {
      id: `event-${Date.now()}`, clubId: id,
      title: newEventTitle.trim(), description: newEventDesc.trim(),
      date: newEventDate, location: newEventLocation.trim() || undefined,
      isPublic: newEventPublic, createdBy: currentUser.id,
    }
    setClubEvents((prev) => [...prev, ev].sort((a, b) => a.date.localeCompare(b.date)))
    setNewEventTitle(''); setNewEventDesc(''); setNewEventDate(''); setNewEventLocation(''); setNewEventPublic(true)
    setShowEventForm(false)
  }

  function deleteEvent(eventId: string) {
    setClubEvents((prev) => prev.filter((e) => e.id !== eventId))
  }

  // --- News ---
  function postNews() {
    if (!newNewsTitle.trim() || !newNewsContent.trim()) return
    const news: ClubNews = {
      id: `news-${Date.now()}`, clubId: id,
      title: newNewsTitle.trim(), content: newNewsContent.trim(),
      authorId: currentUser.id, createdAt: new Date().toISOString(), isPinned: newNewsPinned,
    }
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

  function deleteNews(newsId: string) {
    setClubNews((prev) => prev.filter((n) => n.id !== newsId))
  }

  // --- Polls ---
  function togglePollCandidate(userId: string) {
    setPollCandidateIds((prev) => prev.includes(userId) ? prev.filter((uid) => uid !== userId) : [...prev, userId])
  }

  function createPoll() {
    if (!pollPositionTitle.trim() || pollCandidateIds.length < 2) return
    const newPoll: Poll = {
      id: `poll-${Date.now()}`, clubId: id, positionTitle: pollPositionTitle.trim(),
      candidates: pollCandidateIds.map((uid) => ({ userId: uid, votes: [] })),
      createdAt: new Date().toISOString(), isOpen: true,
    }
    setPolls((prev) => [...prev, newPoll])
    setPollPositionTitle(''); setPollCandidateIds([]); setShowPollForm(false)
  }

  function castVote(pollId: string, candidateUserId: string) {
    setPolls((prev) => prev.map((p) => p.id === pollId ? {
      ...p, candidates: p.candidates.map((c) => c.userId === candidateUserId ? { ...c, votes: [...c.votes, currentUser.id] } : c),
    } : p))
  }

  function closePoll(pollId: string) {
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

  // ======================== RENDER ========================

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-white rounded-2xl border p-6 mb-6">
        {editMode ? (
          // Edit mode
          <div className="space-y-4">
            <p className="text-sm font-semibold text-gray-700">Editing Club Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Icon (emoji)</label>
                <Input value={editIcon} onChange={(e) => setEditIcon(e.target.value)} placeholder="🤖" className="text-2xl h-10" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tags (comma separated)</label>
                <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="STEM, Arts…" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {/* Social links editor */}
            <div>
              <label className="text-xs text-gray-500 mb-2 block">Social Links</label>
              <div className="space-y-1.5 mb-2">
                {editSocialLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <SocialIcon platform={link.platform} />
                    <span className="text-sm text-gray-600 flex-1 truncate">{link.url}</span>
                    <button onClick={() => removeSocialLink(i)} className="text-red-400 hover:text-red-600">
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={newSocialPlatform}
                  onChange={(e) => setNewSocialPlatform(e.target.value as SocialPlatform)}
                  className="text-sm border rounded px-2 py-1.5"
                >
                  {(Object.keys(PLATFORM_LABELS) as SocialPlatform[]).map((p) => (
                    <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                  ))}
                </select>
                <Input value={newSocialUrl} onChange={(e) => setNewSocialUrl(e.target.value)} placeholder="https://…" className="flex-1 h-8 text-sm" />
                <button onClick={addSocialLink} className="shrink-0 text-blue-600 hover:text-blue-800">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit}>Save Changes</Button>
              <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          // View mode
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <span className="text-5xl">{club.iconUrl ?? '📌'}</span>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{club.name}</h1>
                  {advisor && <p className="text-sm text-gray-500 mt-1">Advisor: {advisor.name}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {club.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Social links */}
                {club.socialLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-gray-700 transition-colors" title={PLATFORM_LABELS[link.platform]}>
                    <SocialIcon platform={link.platform} />
                  </a>
                ))}

                {isAdvisor && (
                  <>
                    <button onClick={startEdit} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 border rounded px-2 py-1">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={toggleAutoAccept}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                        club.autoAccept ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${club.autoAccept ? 'bg-green-500' : 'bg-gray-400'}`} />
                      Auto-accept {club.autoAccept ? 'on' : 'off'}
                    </button>
                  </>
                )}

                {currentUser.role === 'student' && (
                  isMember ? (
                    <Button variant="outline" size="sm" onClick={handleLeave}>Leave Club</Button>
                  ) : myRequest?.status === 'pending' ? (
                    <Button size="sm" disabled variant="outline">
                      <ClockIcon className="w-3.5 h-3.5 mr-1.5" />Request Pending
                    </Button>
                  ) : myRequest?.status === 'rejected' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-500">Request declined</span>
                      <Button size="sm" onClick={handleRequest}>Request Again</Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-end gap-0.5">
                      <Button size="sm" onClick={handleRequest}>Request to Join</Button>
                      {isFull && <span className="text-xs text-gray-400">Club is full — requires manual approval</span>}
                    </div>
                  )
                )}
              </div>
            </div>

            <p className="text-gray-600 mt-4 leading-relaxed">{club.description}</p>

            {currentUser.role === 'student' && !isMember && !myRequest && (
              <p className="text-xs text-gray-400 mt-2">
                {club.autoAccept && !isFull ? 'This club auto-accepts requests — you will be added immediately.'
                  : club.autoAccept && isFull ? 'Club is at capacity — your request will be reviewed manually.'
                  : 'Requests are reviewed manually by the advisor.'}
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ── Left column ── */}
        <div className="md:col-span-2 space-y-6">

          {/* Members */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Members
                  <span className="text-gray-400 font-normal">
                    {club.memberIds.length}/{club.capacity === null ? '∞' : club.capacity}
                  </span>
                </CardTitle>
                {isAdvisor && !editingCapacity && (
                  <button onClick={startEditCapacity} className="text-xs text-blue-600 hover:underline">Edit limit</button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {isAdvisor && editingCapacity && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={capacityUnlimited} onChange={(e) => setCapacityUnlimited(e.target.checked)} />
                    Unlimited
                  </label>
                  {!capacityUnlimited && (
                    <Input type="number" min={club.memberIds.length} value={capacityInput}
                      onChange={(e) => setCapacityInput(e.target.value)} className="w-24 h-8 text-sm" />
                  )}
                  <Button size="sm" className="h-8" onClick={saveCapacity}>Save</Button>
                  <button onClick={() => setEditingCapacity(false)} className="text-xs text-gray-400">Cancel</button>
                </div>
              )}
              {club.capacity !== null && (
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min((club.memberIds.length / club.capacity) * 100, 100)}%` }} />
                </div>
              )}
              <div className="space-y-2">
                {members.map((member) => {
                  if (!member) return null
                  const positions = club.leadershipPositions.filter((lp) => lp.userId === member.id)
                  const canCreate = club.eventCreatorIds.includes(member.id)
                  return (
                    <div key={member.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{member.name}</span>
                        {canCreate && (
                          <span className="text-xs text-purple-600 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
                            Event creator
                          </span>
                        )}
                      </div>
                      <div className="flex gap-1 items-center">
                        {positions.map((pos) => (
                          <Badge key={pos.id} variant="outline" className="text-xs flex items-center gap-1">
                            <Crown className="w-3 h-3 text-yellow-500" />{pos.title}
                          </Badge>
                        ))}
                        {isAdvisor && (
                          <button
                            onClick={() => toggleEventCreator(member.id)}
                            title={canCreate ? 'Revoke event permission' : 'Grant event creation permission'}
                            className={`ml-1 text-xs px-1.5 py-0.5 rounded border transition-colors ${canCreate ? 'text-purple-600 border-purple-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200' : 'text-gray-400 border-gray-200 hover:text-purple-600 hover:border-purple-200'}`}
                          >
                            {canCreate ? '−' : '+'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Join Requests — advisor only */}
          {isAdvisor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" />
                  Join Requests
                  {pendingRequests.length > 0 && (
                    <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      {pendingRequests.length} pending
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingRequests.length === 0 ? (
                  <p className="text-sm text-gray-400">No pending requests.</p>
                ) : (
                  <div className="space-y-2">
                    {isFull && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                        Club is at capacity. Approving will exceed the limit.
                      </p>
                    )}
                    {pendingRequests.map((req, i) => {
                      const student = getUserById(req.userId)
                      return (
                        <div key={req.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-5 text-right">#{i + 1}</span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{student?.name ?? 'Unknown'}</p>
                              <p className="text-xs text-gray-400">Requested {formatTime(req.requestedAt)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(req.id)}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Decline
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleApprove(req.id)}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Club News */}
          {(isMember || isAdvisor) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Newspaper className="w-4 h-4" />
                    Club News
                  </CardTitle>
                  {canCreateContent && (
                    <button onClick={() => setShowNewsForm((v) => !v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />Post
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {canCreateContent && showNewsForm && (
                  <div className="mb-4 p-3 border rounded-lg bg-gray-50 space-y-3">
                    <Input value={newNewsTitle} onChange={(e) => setNewNewsTitle(e.target.value)} placeholder="Title…" className="h-8 text-sm" />
                    <textarea
                      value={newNewsContent}
                      onChange={(e) => setNewNewsContent(e.target.value)}
                      placeholder="Write your update…"
                      rows={3}
                      className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={newNewsPinned} onChange={(e) => setNewNewsPinned(e.target.checked)} />
                        Pin to top
                      </label>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7" onClick={postNews} disabled={!newNewsTitle.trim() || !newNewsContent.trim()}>Post</Button>
                        <button onClick={() => setShowNewsForm(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    </div>
                  </div>
                )}

                {clubNews.length === 0 ? (
                  <p className="text-sm text-gray-400">No news yet.</p>
                ) : (
                  <div className="space-y-3">
                    {clubNews.map((news) => {
                      const author = getUserById(news.authorId)
                      return (
                        <div key={news.id} className={`border rounded-lg p-3 ${news.isPinned ? 'border-blue-200 bg-blue-50/40' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {news.isPinned && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">Pinned</span>}
                              <p className="font-medium text-sm text-gray-900">{news.title}</p>
                            </div>
                            {(isAdvisor || news.authorId === currentUser.id) && (
                              <button onClick={() => deleteNews(news.id)} className="text-gray-300 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{news.content}</p>
                          <p className="text-xs text-gray-400 mt-2">
                            {author?.name} · {formatTime(news.createdAt)}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Club Elections */}
          {(isMember || isAdvisor) && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Vote className="w-4 h-4" />Club Elections
                  </CardTitle>
                  {isAdvisor && (
                    <button onClick={() => setShowPollForm((v) => !v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />New election
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isAdvisor && showPollForm && (
                  <div className="mb-4 p-3 border rounded-lg bg-gray-50 space-y-3">
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">New Election Poll</p>
                    <Input value={pollPositionTitle} onChange={(e) => setPollPositionTitle(e.target.value)} placeholder="Position title…" className="h-8 text-sm" />
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Candidates (select 2+, must be club members)</p>
                      {members.map((m) => m && (
                        <label key={m.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mb-1">
                          <input type="checkbox" checked={pollCandidateIds.includes(m.id)} onChange={() => togglePollCandidate(m.id)} />
                          {m.name}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8" onClick={createPoll} disabled={!pollPositionTitle.trim() || pollCandidateIds.length < 2}>Start Election</Button>
                      <button onClick={() => setShowPollForm(false)} className="text-xs text-gray-400">Cancel</button>
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
                        <div key={poll.id} className={`border rounded-lg p-3 ${!poll.isOpen ? 'opacity-75' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-900">{poll.positionTitle} Election</p>
                            <div className="flex items-center gap-2">
                              {poll.isOpen ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Open</span>
                                : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Closed</span>}
                              {isAdvisor && poll.isOpen && (
                                <div className="flex gap-1">
                                  <button onClick={() => appointPollWinner(poll.id)} className="text-xs text-blue-600 hover:underline">Close & appoint</button>
                                  <span className="text-gray-300">|</span>
                                  <button onClick={() => closePoll(poll.id)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
                                </div>
                              )}
                            </div>
                          </div>
                          {winner && <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 mb-2">Winner: {getUserById(winner.userId)?.name}</p>}
                          <div className="space-y-2">
                            {poll.candidates.map((candidate) => {
                              const user = getUserById(candidate.userId)
                              const pct = totalVotes > 0 ? Math.round((candidate.votes.length / totalVotes) * 100) : 0
                              const hasVotedThis = candidate.votes.includes(currentUser.id)
                              return (
                                <div key={candidate.userId} className="flex items-center gap-3">
                                  {poll.isOpen && isMember && !isAdvisor && !alreadyVoted ? (
                                    <button onClick={() => castVote(poll.id, candidate.userId)} className="w-4 h-4 rounded-full border-2 border-blue-400 shrink-0 hover:bg-blue-50" />
                                  ) : (
                                    <span className={`w-4 h-4 rounded-full shrink-0 flex items-center justify-center text-xs ${hasVotedThis ? 'bg-blue-500 text-white' : 'border border-gray-300'}`}>{hasVotedThis ? '✓' : ''}</span>
                                  )}
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between mb-0.5">
                                      <span className="text-sm text-gray-700">{user?.name}</span>
                                      <span className="text-xs text-gray-400">{candidate.votes.length} vote{candidate.votes.length !== 1 ? 's' : ''}{totalVotes > 0 && ` (${pct}%)`}</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                      <div className="bg-blue-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {poll.isOpen && isMember && !isAdvisor && (
                            <p className="text-xs text-gray-400 mt-2">{alreadyVoted ? 'You have voted.' : 'Select a candidate to cast your vote.'}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Events */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />Events
                </CardTitle>
                {canCreateContent && (
                  <button onClick={() => setShowEventForm((v) => !v)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />Add event
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {canCreateContent && showEventForm && (
                <div className="mb-4 p-3 border rounded-lg bg-gray-50 space-y-2">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">New Event</p>
                  <Input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="Event title…" className="h-8 text-sm" />
                  <textarea value={newEventDesc} onChange={(e) => setNewEventDesc(e.target.value)} placeholder="Description…" rows={2}
                    className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Date</label>
                      <Input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="h-8 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Location</label>
                      <Input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="Room 204…" className="h-8 text-sm" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input type="checkbox" checked={newEventPublic} onChange={(e) => setNewEventPublic(e.target.checked)} />
                    Public event (visible on Events page)
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-8" onClick={createEvent} disabled={!newEventTitle.trim() || !newEventDate}>Create Event</Button>
                    <button onClick={() => setShowEventForm(false)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                </div>
              )}

              {clubEvents.length === 0 ? (
                <p className="text-sm text-gray-400">No events yet.</p>
              ) : (
                <div className="space-y-3">
                  {clubEvents.map((event) => {
                    const creator = getUserById(event.createdBy)
                    const canDelete = isAdvisor || event.createdBy === currentUser.id
                    return (
                      <div key={event.id} className="border rounded-lg p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-gray-900">{event.title}</p>
                              {!event.isPublic && <span className="text-xs text-gray-400 border rounded px-1">Members only</span>}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{event.description}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <span className="text-xs text-gray-400">{event.date}</span>
                              {event.location && (
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <MapPin className="w-3 h-3" />{event.location}
                                </span>
                              )}
                              {creator && <span className="text-xs text-gray-400">by {creator.name}</span>}
                            </div>
                          </div>
                          {canDelete && (
                            <button onClick={() => deleteEvent(event.id)} className="text-gray-300 hover:text-red-400 shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* My Attendance — student members only */}
          {isMember && !isAdvisor && currentUser.role === 'student' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />My Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myAttendance.length === 0 ? (
                  <p className="text-sm text-gray-400">No records yet.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600">{myPresent}/{myAttendance.length} sessions</span>
                      <span className="text-sm font-semibold text-gray-800">
                        {Math.round((myPresent / myAttendance.length) * 100)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full ${myPresent / myAttendance.length >= 0.8 ? 'bg-green-500' : myPresent / myAttendance.length >= 0.5 ? 'bg-yellow-500' : 'bg-red-400'}`}
                        style={{ width: `${Math.round((myPresent / myAttendance.length) * 100)}%` }}
                      />
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {[...myAttendance].sort((a, b) => b.meetingDate.localeCompare(a.meetingDate)).map((rec) => (
                        <div key={rec.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">{rec.meetingDate}</span>
                          <span className={rec.present ? 'text-green-600 font-medium' : 'text-red-500'}>
                            {rec.present ? 'Present' : 'Absent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* All Attendance — advisor only */}
          {isAdvisor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />Attendance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {memberAttendance.length === 0 ? (
                  <p className="text-sm text-gray-400">No members yet.</p>
                ) : (
                  <div className="space-y-3">
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
                                <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-400'}`}
                                  style={{ width: `${pct}%` }} />
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">{pct}% attendance</p>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Leadership */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-500" />Leadership
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {club.leadershipPositions.map((pos) => {
                  const holder = pos.userId ? getUserById(pos.userId) : null
                  return (
                    <div key={pos.id}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-400 uppercase tracking-wide">{pos.title}</p>
                        {isAdvisor && (
                          <button onClick={() => removePosition(pos.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-800 mb-1">
                        {holder ? holder.name : <span className="text-gray-400 font-normal">Vacant</span>}
                      </p>
                      {isAdvisor && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <select
                            value={appointSelections[pos.id] ?? ''}
                            onChange={(e) => setAppointSelections((prev) => ({ ...prev, [pos.id]: e.target.value }))}
                            className="text-xs border rounded px-1.5 py-1 bg-white text-gray-600 flex-1 min-w-0"
                          >
                            <option value="">Select member…</option>
                            {members.map((m) => m && <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <button onClick={() => appointMember(pos.id)} disabled={!appointSelections[pos.id]}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 shrink-0">
                            <UserCheck className="w-3 h-3" />Appoint
                          </button>
                          {holder && (
                            <button onClick={() => removeAppointment(pos.id)} className="text-gray-400 hover:text-red-500 shrink-0">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                {isAdvisor && (
                  <div className="pt-2 border-t flex items-center gap-1.5">
                    <Input value={newPositionTitle} onChange={(e) => setNewPositionTitle(e.target.value)}
                      placeholder="New position title…" className="h-8 text-xs flex-1"
                      onKeyDown={(e) => e.key === 'Enter' && addPosition()} />
                    <button onClick={addPosition} disabled={!newPositionTitle.trim()}
                      className="h-8 w-8 flex items-center justify-center rounded border bg-white text-gray-500 hover:text-blue-600 hover:border-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Meeting Times */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />Meeting Times
              </CardTitle>
            </CardHeader>
            <CardContent>
              {club.meetingTimes.length === 0 && !isAdvisor && (
                <p className="text-sm text-gray-400">No meeting times set.</p>
              )}
              <div className="space-y-2 mb-3">
                {club.meetingTimes.map((mt) => (
                  <div key={mt.id} className="flex items-start justify-between">
                    <div className="text-sm">
                      <p className="font-medium text-gray-800">{DAY_NAMES[mt.dayOfWeek]}s — {mt.startTime}–{mt.endTime}</p>
                      {mt.location && (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />{mt.location}
                        </p>
                      )}
                    </div>
                    {isAdvisor && (
                      <button onClick={() => removeMeetingTime(mt.id)} className="text-gray-300 hover:text-red-400 ml-2 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {isAdvisor && (
                <div className="pt-2 border-t space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Add meeting time</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select value={newMeetingDay} onChange={(e) => setNewMeetingDay(Number(e.target.value))}
                      className="text-xs border rounded px-2 py-1.5 col-span-2">
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}s</option>)}
                    </select>
                    <div>
                      <label className="text-xs text-gray-400 block mb-0.5">Start</label>
                      <Input type="time" value={newMeetingStart} onChange={(e) => setNewMeetingStart(e.target.value)} className="h-7 text-xs" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-0.5">End</label>
                      <Input type="time" value={newMeetingEnd} onChange={(e) => setNewMeetingEnd(e.target.value)} className="h-7 text-xs" />
                    </div>
                    <Input value={newMeetingLocation} onChange={(e) => setNewMeetingLocation(e.target.value)}
                      placeholder="Location (optional)" className="h-7 text-xs col-span-2" />
                  </div>
                  <Button size="sm" className="h-7 w-full text-xs" onClick={addMeetingTime}>Add</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
