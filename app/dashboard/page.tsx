'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { useIsMobilePhone } from '@/components/mobile/useIsAdminPhone'
import AdminHome from '@/components/mobile/screens/AdminHome'
import StudentHome from '@/components/mobile/screens/StudentHome'
import AdvisorHome from '@/components/mobile/screens/AdvisorHome'
import { apiResolveIssue } from '@/lib/school-api'
import { Users, BookOpen, Pin, Calendar, MessageSquare, CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp, ArrowRight, Plus, X } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { FadeIn, Stagger } from '@/components/ui/FadeIn'
import ClubForm from '@/components/admin/ClubForm'
import ScanCheckInButton from '@/components/ScanCheckInButton'
import { motion, AnimatePresence } from 'framer-motion'
import type { Club, ClubEvent, ClubNews, JoinRequest } from '@/types'
import { toast } from 'sonner'
import { cachedFetch, invalidateCachePrefix } from '@/lib/fetch-cache'

function getPattern(club: Club): 'chess' | 'art' | 'robotics' {
  const tags = (club.tags ?? []).map((t) => t.toLowerCase())
  if (tags.some((t) => ['stem', 'engineering', 'technology', 'robotics'].includes(t))) return 'robotics'
  if (tags.some((t) => ['arts', 'art', 'performance', 'theatre', 'music', 'creative'].includes(t))) return 'art'
  return 'chess'
}

const PATTERN_ICON_STYLES: Record<string, { bg: string; text: string }> = {
  robotics: { bg: 'rgba(0, 88, 190, 0.08)', text: '#0058be' },
  art:      { bg: 'rgba(16, 185, 129, 0.08)', text: '#059669' },
  chess:    { bg: '#edeeef', text: '#374151' },
}

export default function DashboardPage() {
  const mobile = useIsMobilePhone()
  const { currentUser } = useMockAuth()
  if (mobile) {
    if (currentUser.role === 'student') return <StudentHome />
    if (currentUser.role === 'advisor') return <AdvisorHome />
    return <AdminHome />
  }
  return <DesktopDashboard />
}

function DesktopDashboard() {
  const { currentUser } = useMockAuth()
  const [myClubs, setMyClubs] = useState<Club[]>([])
  const [advisorNames, setAdvisorNames] = useState<Record<string, string>>({})
  const [pinnedNews, setPinnedNews] = useState<Record<string, ClubNews>>({})
  const [nextEvents, setNextEvents] = useState<Record<string, ClubEvent>>({})
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([])
  const [issueReports, setIssueReports] = useState<{ id: string; reporter_name: string; reporter_email: string; message: string; status: string; created_at: string }[]>([])
  const [showPending, setShowPending] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreateClub, setShowCreateClub] = useState(false)

  useEffect(() => {
    // Guard on id — the server resolves school context.
    if (!currentUser.id) return

    cachedFetch<{
        clubs?: Club[]
        advisorNames?: Record<string, string>
        pinnedNews?: Record<string, ClubNews>
        nextEvents?: Record<string, ClubEvent>
        pendingRequests?: JoinRequest[]
        issueReports?: { id: string; reporter_name: string; reporter_email: string; message: string; status: string; created_at: string }[]
      }>('/api/school/dashboard', { ttl: 30_000 })
      .then((payload) => {
        setMyClubs(payload.clubs ?? [])
        setAdvisorNames(payload.advisorNames ?? {})
        setPinnedNews(payload.pinnedNews ?? {})
        setNextEvents(payload.nextEvents ?? {})
        setPendingRequests(payload.pendingRequests ?? [])
        setIssueReports(payload.issueReports ?? [])
        setIsLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard')
        setIsLoading(false)
      })
  }, [currentUser.id, currentUser.role])

  async function resolveIssue(id: string) {
    try {
      await apiResolveIssue(id)
    } catch {
      toast.error('Failed to resolve issue'); return
    }
    setIssueReports((prev) => prev.map((r) => r.id === id ? { ...r, status: 'resolved' } : r))
    invalidateCachePrefix('/api/school/dashboard')
    toast.success('Issue resolved')
  }

  async function handleCreateClub(
    data: Omit<Club, 'id' | 'memberIds' | 'leadershipPositions' | 'socialLinks' | 'meetingTimes' | 'createdAt'>
  ) {
    const res = await fetch('/api/school/clubs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const payload = await res.json()
    if (!res.ok) {
      throw new Error(payload.error ?? 'Failed to create club')
    }
    invalidateCachePrefix('/api/school/dashboard')
    const refreshed = await cachedFetch<{ clubs?: Club[]; advisorNames?: Record<string, string> }>(
      '/api/school/dashboard',
      { bust: true },
    )
    setMyClubs(refreshed.clubs ?? [])
    setAdvisorNames(refreshed.advisorNames ?? {})
    setShowCreateClub(false)
    toast.success('Club created!')
  }

  const firstName = currentUser.name.split(' ')[0]

  if (currentUser.role === 'superadmin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">
          Head to the{' '}
          <Link href="/superadmin" className="text-purple-600 underline font-semibold">Super Admin Panel</Link>{' '}
          to manage schools and tenants.
        </p>
      </div>
    )
  }

  if (currentUser.role === 'admin') {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">
          As an admin, your dashboard is the{' '}
          <Link href="/admin" className="text-blue-600 underline">Admin Panel</Link>.
        </p>
      </div>
    )
  }

  const ClubCard = ({ club }: { club: Club }) => {
    const pattern = getPattern(club)
    const iconStyle = PATTERN_ICON_STYLES[pattern]
    const pinnedUpdate = pinnedNews[club.id] ?? null
    const nextEvent = nextEvents[club.id] ?? null
    const advisorName = advisorNames[club.advisorId]

    return (
      <Link href={`/clubs/${club.id}`}>
        <div
          className="relative overflow-hidden bg-white rounded-xl p-6 transition-all duration-300 hover:scale-[1.01] cursor-pointer"
          style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}
        >
          <div className={`absolute right-0 top-0 w-[40%] h-full editorial-pattern-${pattern}`} />
          <div className="relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: iconStyle.bg }}>
                {club.iconUrl ?? '📌'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="mb-1">
                  <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full" style={{ background: 'rgba(146, 71, 0, 0.1)', color: '#924700' }}>
                    {currentUser.role}
                  </span>
                </div>
                <h3 className="font-bold text-[#191c1d] leading-tight text-lg" style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                  {club.name}
                </h3>
                {advisorName && <p className="text-sm font-medium text-[#727785]">Advisor: {advisorName}</p>}
                {currentUser.role === 'advisor' && (
                  <p className="text-xs text-[#727785]">{club.memberIds.length} member{club.memberIds.length !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>

            {(pinnedUpdate || nextEvent) && (
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                {pinnedUpdate ? (
                  <div className="flex items-start gap-2 min-w-0">
                    <Pin className="w-3 h-3 mt-0.5 shrink-0" style={{ color: '#924700' }} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#924700' }}>Pinned</p>
                      <p className="text-xs font-semibold text-[#191c1d] truncate leading-snug">{pinnedUpdate.title}</p>
                      <p className="text-[11px] text-[#727785] leading-snug line-clamp-2 mt-0.5">{pinnedUpdate.content}</p>
                    </div>
                  </div>
                ) : <div />}

                {nextEvent ? (
                  <div className="flex items-start gap-2 min-w-0">
                    <Calendar className="w-3 h-3 mt-0.5 shrink-0 text-[#0058be]" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] mb-0.5">Next Event</p>
                      <p className="text-xs font-semibold text-[#191c1d] truncate leading-snug">{nextEvent.title}</p>
                      <p className="text-[11px] text-[#727785] mt-0.5">
                        {new Date(nextEvent.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                ) : <div />}
              </div>
            )}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-0">
      <FadeIn className="mb-10" y={20}>
        <div className="p-6 rounded-xl" style={{ background: 'rgba(33, 112, 228, 0.08)', border: '1px solid rgba(0, 88, 190, 0.1)' }}>
          <h2 className="text-3xl font-extrabold text-[#191c1d] tracking-tight leading-none mb-2" style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
            Hi, {firstName}!
          </h2>
          {pendingRequests.length > 0 && (
            <button
              onClick={() => setShowPending((v) => !v)}
              className="flex items-center gap-2 font-medium text-[#0058be] hover:text-[#0047a0] transition-colors cursor-pointer"
            >
              <Clock className="w-4 h-4" />
              You have {pendingRequests.length} pending club request{pendingRequests.length !== 1 ? 's' : ''}
              {showPending ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {currentUser.role === 'advisor' && myClubs.length > 0 && (
            <p className="font-medium text-[#0058be]">
              You are advising {myClubs.length} club{myClubs.length !== 1 ? 's' : ''}.
            </p>
          )}
          {currentUser.role === 'advisor' && (
            <button
              onClick={() => setShowCreateClub(true)}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold bg-[#0058be] text-white px-4 py-2 rounded-xl hover:bg-[#0047a0] transition-colors shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              Create a club
            </button>
          )}
        </div>

        {/* Scan a meeting QR to check in — MLKit on native, BarcodeDetector/jsQR on web */}
        <ScanCheckInButton className="mt-4 inline-flex items-center justify-center gap-2 min-h-[48px] rounded-xl bg-[#0058be] text-white text-sm font-bold px-5 py-3 shadow-lg shadow-blue-500/20 active:translate-y-px transition-transform touch-manipulation" />

        {showPending && pendingRequests.length > 0 && (
          <div className="mt-4 rounded-xl bg-white border border-slate-200/60 overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
            {(pendingRequests as (JoinRequest & { clubName?: string; clubIcon?: string })[]).map((req, i) => (
              <Link key={req.id} href={`/clubs/${req.clubId}`}>
                <div className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors ${i > 0 ? 'border-t border-slate-100' : ''}`}>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200/60 flex items-center justify-center text-lg shrink-0">
                    {req.clubIcon ?? '📌'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate" style={{ fontFamily: 'var(--font-manrope)' }}>
                      {req.clubName ?? 'Unknown Club'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Requested {new Date(req.requestedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                      Pending
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </FadeIn>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Failed to load dashboard</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
          </div>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-5">
                  <Skeleton className="w-14 h-14 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-16 rounded-full" />
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : myClubs.length === 0 ? (
          <FadeIn className="text-center py-20 bg-white rounded-xl border">
            {currentUser.role === 'advisor'
              ? (
                <div className="max-w-sm mx-auto">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium mb-4">You are not advising any clubs yet.</p>
                  <button
                    onClick={() => setShowCreateClub(true)}
                    className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#0058be] text-white px-4 py-2 rounded-xl hover:bg-[#0047a0] transition-colors shadow-lg shadow-blue-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    Create your first club
                  </button>
                </div>
              )
              : <div className="max-w-sm mx-auto">
                  <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(0, 88, 190, 0.08)' }}>
                    <BookOpen className="w-8 h-8 text-[#0058be]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#191c1d] mb-2" style={{ fontFamily: 'var(--font-manrope, sans-serif)' }}>
                    Welcome to ClubIt!
                  </h3>
                  <p className="text-sm text-[#727785] leading-relaxed mb-6">
                    Clubs are student-run communities where you can explore interests, build skills, and meet new people. Browse the directory to find one that fits you.
                  </p>
                  <Link href="/clubs">
                    <button className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest text-white transition-colors hover:bg-[#0047a0]" style={{ background: '#0058be', fontFamily: 'var(--font-manrope, sans-serif)' }}>
                      Browse Clubs
                    </button>
                  </Link>
                </div>
            }
          </FadeIn>
        ) : (
          <Stagger className="flex flex-col gap-6" stagger={0.07}>
            {myClubs.map((club) => (
              <Stagger.Item key={club.id}><ClubCard club={club} /></Stagger.Item>
            ))}
          </Stagger>
        )}

        <div className="mt-8 rounded-xl p-8 flex flex-col items-center text-center" style={{ border: '2px dashed rgba(194, 198, 214, 0.4)' }}>
          <p className="text-sm font-medium text-[#727785] mb-4">Want to expand your horizons?</p>
          <Link href="/clubs">
            <button className="font-bold py-3 px-8 rounded-full text-sm uppercase tracking-widest transition-colors hover:bg-gray-200" style={{ background: '#e1e3e4', color: '#191c1d', fontFamily: 'var(--font-manrope, sans-serif)' }}>
              EXPLORE ALL CLUBS
            </button>
          </Link>
        </div>

        {/* Issue reports — visible to advisors */}
        {currentUser.role === 'advisor' && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-orange-500" />
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Issue Reports</h3>
              {issueReports.filter((r) => r.status === 'open').length > 0 && (
                <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  {issueReports.filter((r) => r.status === 'open').length} open
                </span>
              )}
            </div>
            {issueReports.length === 0 ? (
              <p className="text-sm text-gray-400">No issue reports yet.</p>
            ) : (
              <div className="space-y-3">
                {issueReports.map((report) => (
                  <div key={report.id} className={`bg-white rounded-xl border border-gray-100 p-4 ${report.status === 'resolved' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{report.reporter_name}</span>
                          <span className="text-xs text-gray-400">{report.reporter_email}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${report.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {report.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{report.message}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                      {report.status === 'open' && (
                        <button onClick={() => resolveIssue(report.id)}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create-club modal — advisors only */}
      <AnimatePresence>
        {showCreateClub && currentUser.role === 'advisor' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateClub(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 pt-5">
                <h2 className="text-base font-semibold text-gray-900">New club</h2>
                <button
                  onClick={() => setShowCreateClub(false)}
                  className="text-gray-400 hover:text-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-2">
                <ClubForm
                  advisors={[{
                    id: currentUser.id,
                    name: currentUser.name,
                    email: currentUser.email,
                    role: 'advisor',
                    schoolId: currentUser.schoolId,
                  }]}
                  onSubmit={handleCreateClub}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
