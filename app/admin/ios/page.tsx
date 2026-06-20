'use client'

/**
 * ClubIt Admin — iOS
 *
 * Faithful implementation of the "ClubIt Admin - iOS" Claude Design prototype.
 * A self-contained, mobile-first admin experience (school-admin role) that runs
 * full-screen inside the Capacitor iOS shell and in the browser. Navigation is a
 * client-side state machine over mock data — wire the view-models to Supabase
 * (/api/school/*, /api/admin/*) to make it live.
 *
 * Rendered bare (no global sidebar/tab bar) — see BARE_ROUTES in AppShell.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'

/* ----------------------------------------------------------------------------
 * css(): parse the design's inline CSS strings into React style objects so the
 * markup stays byte-for-byte faithful to the prototype.
 * -------------------------------------------------------------------------- */
function css(str: string): CSSProperties {
  const out: Record<string, string> = {}
  for (const decl of str.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (!key) continue
    out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val
  }
  return out as CSSProperties
}

// Safe-area-aware top padding for screen headers (status bar / Dynamic Island).
const TOP = (extra = 20) => `calc(env(safe-area-inset-top, 0px) + ${extra}px)`
// Safe-area-aware bottom padding for the tab bar.
const BOTTOM = (extra = 10) => `calc(env(safe-area-inset-bottom, 0px) + ${extra}px)`

/* ----------------------------------------------------------------------------
 * Data (mock — Westfield High School)
 * -------------------------------------------------------------------------- */
const AV = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6', '#f43f5e', '#3b82f6']
function avBg(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AV[h % AV.length]
}
function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase()
}

interface Club {
  id: string; icon: string; name: string; advisor: string; count: number; cap: number | null
  tag: string; tint: string; gradient: string; president: string; meetingDays: string
  meetingTime: string; location: string; tags: string[]; description: string; members: string[]
}
const CLUBS: Club[] = [
  { id: 'robotics', icon: '🤖', name: 'Robotics Club', advisor: 'Ms. Patel', count: 18, cap: 20, tag: 'STEM', tint: '#eef0ff', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)', president: 'Alex Rivera', meetingDays: 'Tue & Thu', meetingTime: '3:00–4:30 PM', location: 'Room 204', tags: ['STEM', 'Engineering', 'Competition'], description: 'Build and program robots to compete in regional and national competitions. No experience required — just curiosity and drive.', members: ['Alex Rivera|President', 'Jordan Kim|Vice President', 'Maya Patel|Build Lead', 'Sam Okafor|Member', 'Diego Santos|Member'] },
  { id: 'drama', icon: '🎭', name: 'Drama Club', advisor: 'Mr. Thompson', count: 24, cap: 30, tag: 'Arts', tint: '#fdecf2', gradient: 'linear-gradient(135deg,#ec4899,#f472b6)', president: 'Sam Okafor', meetingDays: 'Mon & Wed', meetingTime: '2:30–4:00 PM', location: 'Auditorium', tags: ['Arts', 'Performance', 'Theatre'], description: 'Perform in school plays and musicals, develop stage presence, and explore the world of theatre. Open to all skill levels.', members: ['Sam Okafor|President', 'Priya Nair|Stage Manager', 'Zoe Chen|Member', 'Noah Williams|Member'] },
  { id: 'chess', icon: '♟️', name: 'Chess Club', advisor: 'Ms. Patel', count: 15, cap: null, tag: 'Strategy', tint: '#eef0f3', gradient: 'linear-gradient(135deg,#475569,#64748b)', president: 'Alex Rivera', meetingDays: 'Wednesday', meetingTime: '3:00–4:00 PM', location: 'Library', tags: ['Strategy', 'Competition', 'Games'], description: 'Sharpen your strategy and compete against other schools. Beginners welcome — experienced members will help you learn.', members: ['Alex Rivera|President', 'Liam O’Brien|Tournament Coord.', 'Ava Johnson|Member'] },
  { id: 'environment', icon: '🌱', name: 'Environmental Club', advisor: 'Mr. Thompson', count: 22, cap: 25, tag: 'Community', tint: '#e8faf2', gradient: 'linear-gradient(135deg,#10b981,#34d399)', president: 'Jordan Kim', meetingDays: 'Friday', meetingTime: '12:00–1:00 PM', location: 'Room 101', tags: ['Environment', 'Community', 'Activism'], description: 'Take action on sustainability, organize campus clean-ups, and raise awareness about environmental issues in our community.', members: ['Jordan Kim|Events Coord.', 'Maya Patel|Member', 'Sofia Martinez|Member'] },
  { id: 'debate', icon: '🗣️', name: 'Debate Team', advisor: 'Ms. Alvarez', count: 16, cap: 18, tag: 'Academics', tint: '#eef0ff', gradient: 'linear-gradient(135deg,#3b82f6,#60a5fa)', president: 'Diego Santos', meetingDays: 'Tue & Fri', meetingTime: '3:30–5:00 PM', location: 'Room 110', tags: ['Academics', 'Public Speaking'], description: 'Compete in policy and Lincoln-Douglas debate. Build research, argumentation, and public speaking skills.', members: ['Diego Santos|Captain', 'Priya Nair|Member', 'Ethan Brooks|Member'] },
  { id: 'art', icon: '🎨', name: 'Art Society', advisor: 'Mr. Thompson', count: 12, cap: 20, tag: 'Arts', tint: '#fdecf2', gradient: 'linear-gradient(135deg,#f43f5e,#fb7185)', president: 'Zoe Chen', meetingDays: 'Thursday', meetingTime: '3:00–4:30 PM', location: 'Art Studio', tags: ['Arts', 'Creative'], description: 'Explore painting, drawing, and mixed media. Showcase work in the annual student exhibition.', members: ['Zoe Chen|President', 'Ava Johnson|Member'] },
  { id: 'coding', icon: '💻', name: 'Coding Club', advisor: 'Ms. Patel', count: 28, cap: 30, tag: 'STEM', tint: '#eef0ff', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', president: 'Liam O’Brien', meetingDays: 'Mon & Wed', meetingTime: '3:00–4:30 PM', location: 'Computer Lab', tags: ['STEM', 'Software'], description: 'Learn to build apps and games, prep for hackathons, and collaborate on open-source projects.', members: ['Liam O’Brien|President', 'Alex Rivera|Member', 'Ethan Brooks|Member'] },
  { id: 'photo', icon: '📷', name: 'Photography', advisor: 'Ms. Reed', count: 9, cap: 15, tag: 'Arts', tint: '#fff7e6', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', president: 'Sofia Martinez', meetingDays: 'Friday', meetingTime: '3:00–4:00 PM', location: 'Room 215', tags: ['Arts', 'Photography'], description: 'Capture campus life and develop your eye for composition, light, and storytelling through images.', members: ['Sofia Martinez|President', 'Noah Williams|Member'] },
]

interface Student { id: string; name: string; email: string; grade: string; xp: number; clubs: [string, string, string][]; attendance: string }
const STUDENTS: Student[] = [
  { id: 's1', name: 'Alex Rivera', email: 'alex@westfield.edu', grade: 'Grade 12', xp: 1420, clubs: [['🤖', 'Robotics Club', 'President'], ['♟️', 'Chess Club', 'President'], ['💻', 'Coding Club', 'Member']], attendance: '96%' },
  { id: 's2', name: 'Jordan Kim', email: 'jordan@westfield.edu', grade: 'Grade 11', xp: 1280, clubs: [['🤖', 'Robotics Club', 'Vice President'], ['🌱', 'Environmental Club', 'Events Coord.']], attendance: '92%' },
  { id: 's3', name: 'Sam Okafor', email: 'sam@westfield.edu', grade: 'Grade 12', xp: 1190, clubs: [['🎭', 'Drama Club', 'President']], attendance: '88%' },
  { id: 's4', name: 'Maya Patel', email: 'maya@westfield.edu', grade: 'Grade 10', xp: 1075, clubs: [['🤖', 'Robotics Club', 'Build Lead'], ['🌱', 'Environmental Club', 'Member']], attendance: '94%' },
  { id: 's5', name: 'Diego Santos', email: 'diego@westfield.edu', grade: 'Grade 11', xp: 980, clubs: [['🗣️', 'Debate Team', 'Captain']], attendance: '90%' },
  { id: 's6', name: 'Priya Nair', email: 'priya@westfield.edu', grade: 'Grade 12', xp: 910, clubs: [['🎭', 'Drama Club', 'Stage Manager'], ['🗣️', 'Debate Team', 'Member']], attendance: '85%' },
  { id: 's7', name: 'Liam O’Brien', email: 'liam@westfield.edu', grade: 'Grade 11', xp: 870, clubs: [['💻', 'Coding Club', 'President'], ['♟️', 'Chess Club', 'Member']], attendance: '91%' },
  { id: 's8', name: 'Zoe Chen', email: 'zoe@westfield.edu', grade: 'Grade 10', xp: 840, clubs: [['🎨', 'Art Society', 'President']], attendance: '87%' },
  { id: 's9', name: 'Noah Williams', email: 'noah@westfield.edu', grade: 'Grade 12', xp: 760, clubs: [['🎭', 'Drama Club', 'Member'], ['📷', 'Photography', 'Member']], attendance: '80%' },
  { id: 's10', name: 'Ava Johnson', email: 'ava@westfield.edu', grade: 'Grade 11', xp: 690, clubs: [['🎨', 'Art Society', 'Member'], ['♟️', 'Chess Club', 'Member']], attendance: '83%' },
  { id: 's11', name: 'Ethan Brooks', email: 'ethan@westfield.edu', grade: 'Grade 10', xp: 620, clubs: [['💻', 'Coding Club', 'Member'], ['🗣️', 'Debate Team', 'Member']], attendance: '78%' },
  { id: 's12', name: 'Sofia Martinez', email: 'sofia@westfield.edu', grade: 'Grade 12', xp: 540, clubs: [['📷', 'Photography', 'President'], ['🌱', 'Environmental Club', 'Member']], attendance: '82%' },
]

const REQUESTS = [
  { id: 'rq1', name: 'Sam Okafor', club: 'Robotics Club' },
  { id: 'rq2', name: 'Maya Patel', club: 'Drama Club' },
  { id: 'rq3', name: 'Diego Santos', club: 'Debate Team' },
]

interface Thread { id: string; icon: string; tint: string; name: string; last: string; time: string; unread: number; memberCount: number }
const THREADS: Thread[] = [
  { id: 'robotics', icon: '🤖', tint: '#eef0ff', name: 'Robotics Club', last: 'On it. Also thinking about a sensor array…', time: '10:01', unread: 3, memberCount: 18 },
  { id: 'drama', icon: '🎭', tint: '#fdecf2', name: 'Drama Club', last: 'Come prepared with a 2-minute monologue.', time: 'Yesterday', unread: 0, memberCount: 24 },
  { id: 'environment', icon: '🌱', tint: '#e8faf2', name: 'Environmental Club', last: 'Count me in. I can bring extra gloves and bags.', time: 'Mon', unread: 0, memberCount: 22 },
  { id: 'chess', icon: '♟️', tint: '#eef0f3', name: 'Chess Club', last: 'Works for me. I’ll bring the boards.', time: 'Mon', unread: 0, memberCount: 15 },
  { id: 'coding', icon: '💻', tint: '#eef0ff', name: 'Coding Club', last: 'Hackathon teams locked in for May 10.', time: 'Sun', unread: 0, memberCount: 28 },
  { id: 'debate', icon: '🗣️', tint: '#eef0ff', name: 'Debate Team', last: 'Great rounds today, everyone. Rest up.', time: 'Sat', unread: 0, memberCount: 16 },
]

interface Msg { sender: string; content: string; mine: boolean }
const MESSAGES: Record<string, Msg[]> = {
  robotics: [
    { sender: 'Alex Rivera', content: 'Hey team! Anyone working on the chassis this week?', mine: false },
    { sender: 'Jordan Kim', content: 'Yeah, I’ll be in Room 204 on Tuesday after school.', mine: false },
    { sender: 'Ms. Patel', content: 'Great! Remember the qualifier is April 20th. Make sure the motors are calibrated before then.', mine: false },
    { sender: 'You', content: 'Thanks Ms. Patel — I’ll make sure the gym is booked for a practice run.', mine: true },
    { sender: 'Alex Rivera', content: 'On it. Also thinking about adding a sensor array for the obstacle course.', mine: false },
  ],
  drama: [
    { sender: 'Sam Okafor', content: 'Auditions are April 15th — who else is trying out?', mine: false },
    { sender: 'Mr. Thompson', content: 'Come prepared with a 2-minute monologue. Sheet music handed out on the day.', mine: false },
  ],
  environment: [
    { sender: 'Jordan Kim', content: 'Earth Day is April 22nd. Who’s coming to the campus clean-up?', mine: false },
    { sender: 'Mr. Thompson', content: 'Count me in. I can bring extra gloves and bags.', mine: false },
  ],
  chess: [
    { sender: 'Alex Rivera', content: 'Tournament is May 3rd. Want to do a practice session before?', mine: false },
    { sender: 'Liam O’Brien', content: 'Works for me. I’ll bring the boards.', mine: false },
  ],
  coding: [{ sender: 'Liam O’Brien', content: 'Hackathon teams locked in for May 10.', mine: false }],
  debate: [{ sender: 'Diego Santos', content: 'Great rounds today, everyone. Rest up.', mine: false }],
}

const EVENTS = [
  { month: 'APR', day: '15', tint: '#fdecf2', accent: '#ec4899', title: 'Spring Musical Auditions', club: 'Drama Club', location: 'Auditorium', time: '2:30 PM', visibility: 'Public' },
  { month: 'APR', day: '20', tint: '#eef0ff', accent: '#6366f1', title: 'Regional Robotics Qualifier', club: 'Robotics Club', location: 'Westfield Gym', time: '9:00 AM', visibility: 'Public' },
  { month: 'APR', day: '22', tint: '#e8faf2', accent: '#10b981', title: 'Earth Day Campus Clean-Up', club: 'Environmental Club', location: 'School Grounds', time: '12:00 PM', visibility: 'Public' },
  { month: 'MAY', day: '03', tint: '#eef0f3', accent: '#64748b', title: 'Interschool Chess Tournament', club: 'Chess Club', location: 'Library', time: '10:00 AM', visibility: 'Public' },
  { month: 'MAY', day: '10', tint: '#eef0ff', accent: '#0ea5e9', title: 'Spring Coding Hackathon', club: 'Coding Club', location: 'Computer Lab', time: '9:00 AM', visibility: 'Members' },
]

interface Election { id: string; open: boolean; title: string; desc: string; candidates: [string, number][] }
const ELECTIONS: Election[] = [
  { id: 'e1', open: true, title: 'Student Body President', desc: 'Vote for next year’s Student Body President.', candidates: [['Alex Rivera', 142], ['Maya Patel', 98], ['Diego Santos', 67]] },
  { id: 'e2', open: true, title: 'Student Body Treasurer', desc: 'Manages the student activity fund.', candidates: [['Jordan Kim', 88], ['Sam Okafor', 76]] },
  { id: 'e3', open: false, title: 'Student Body Vice President', desc: '2025–26 school year · final results.', candidates: [['Zoe Chen', 156], ['Noah Williams', 121]] },
]

const REPORTS = [
  { id: 'rep1', reporter: 'Jordan Kim', time: 'Apr 4, 2:14 PM', reason: 'Spam', author: 'Unknown User', club: 'Robotics Club', content: 'Check out this link for free robot parts!! totally-legit-site dot com' },
  { id: 'rep2', reporter: 'Priya Nair', time: 'Apr 3, 9:40 AM', reason: 'Harassment', author: 'Noah Williams', club: 'Drama Club', content: 'That audition was honestly embarrassing, you should just quit.' },
]

const INVITES = [
  { key: 'student', label: 'Students', accent: '#10b981', code: 'STU-4F9K2', expiry: 'Expires in 22 days' },
  { key: 'advisor', label: 'Advisors', accent: '#6366f1', code: 'ADV-8M3X7', expiry: 'Expires in 22 days' },
  { key: 'admin', label: 'Admins', accent: '#e11d48', code: 'ADM-2Q7P1', expiry: 'Expires in 22 days' },
]

const SEND_REPLIES = ['Sounds good — let’s lock it in.', 'Approved. Nice work, team.', 'I’ll follow up with the front office.', 'Thanks for the update!', 'Great. Keep me posted.']

function pct(c: Club) {
  return c.cap ? Math.min(Math.round((c.count / c.cap) * 100), 100) : Math.min(Math.round((c.count / 40) * 100), 100)
}

/* ----------------------------------------------------------------------------
 * Small shared chevron / check icons
 * -------------------------------------------------------------------------- */
const Chevron = ({ stroke = '#c5cad3', size = 17 }: { stroke?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
)

type Screen =
  | 'home' | 'clubs' | 'clubDetail' | 'students' | 'studentProfile'
  | 'chat' | 'chatThread' | 'elections' | 'events' | 'leaderboard'
  | 'moderation' | 'invites' | 'settings' | 'profile'

export default function AdminIOSPage() {
  const [screen, setScreen] = useState<Screen>('home')
  // Home dashboard direction from the design exploration: 'A' Overview (default,
  // balanced & scannable), 'B' Action-first, 'C' Data-forward. Held in state so
  // it stays switchable without re-typing all the variant branches.
  const [homeVariant] = useState<'A' | 'B' | 'C'>('A')
  const [moreOpen, setMoreOpen] = useState(false)
  const [electionsTab, setElectionsTab] = useState<'open' | 'closed'>('open')
  const [currentClubId, setCurrentClubId] = useState('robotics')
  const [currentStudentId, setCurrentStudentId] = useState('s1')
  const [currentThreadId, setCurrentThreadId] = useState('robotics')
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [toastN, setToastN] = useState(0) // nonce so repeat toasts re-arm the timer
  const [settings, setSettings] = useState({ leaderboard: true, chat: true, push: true })
  const [dismissedRequests, setDismissedRequests] = useState<Record<string, boolean>>({})
  const [removedReports, setRemovedReports] = useState<Record<string, boolean>>({})
  const [extraMessages, setExtraMessages] = useState<Record<string, Msg[]>>({})
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setToastN(n => n + 1)
  }

  // Auto-dismiss the toast 1.9s after it (re)appears.
  useEffect(() => {
    if (toast === null) return
    const id = setTimeout(() => setToast(null), 1900)
    return () => clearTimeout(id)
  }, [toast, toastN])
  function nav(s: Screen) { setScreen(s); setMoreOpen(false) }

  // ---- derived view-models ----
  const club = useMemo(() => {
    const c = CLUBS.find(x => x.id === currentClubId) || CLUBS[0]
    return {
      ...c,
      countLabel: c.count + '/' + (c.cap ?? '∞'),
      members: c.members.map(m => { const [name, role] = m.split('|'); return { name, role, initials: initials(name), avBg: avBg(name) } }),
    }
  }, [currentClubId])

  const student = useMemo(() => {
    const s = STUDENTS.find(x => x.id === currentStudentId) || STUDENTS[0]
    return { ...s, initials: initials(s.name), avBg: avBg(s.name), clubCount: s.clubs.length, clubVMs: s.clubs.map(c => ({ icon: c[0], name: c[1], role: c[2] })) }
  }, [currentStudentId])

  const thread = THREADS.find(t => t.id === currentThreadId) || THREADS[0]
  const threadMessages = useMemo(() => {
    const base = (MESSAGES[thread.id] || []).concat(extraMessages[thread.id] || [])
    return base.map((m, i, arr) => {
      const prev = arr[i - 1]
      const showName = !m.mine && (!prev || prev.sender !== m.sender)
      return {
        content: m.content, senderName: m.sender, showName,
        align: m.mine ? 'flex-end' : 'flex-start',
        bubbleBg: m.mine ? '#6366f1' : '#ffffff',
        bubbleColor: m.mine ? '#ffffff' : '#1f2734',
        radius: m.mine ? '18px 18px 5px 18px' : '18px 18px 18px 5px',
      }
    })
  }, [thread.id, extraMessages])

  const sortedStudents = useMemo(() => [...STUDENTS].sort((a, b) => b.xp - a.xp), [])
  const podium = sortedStudents.slice(0, 3).map(x => ({ name: x.name.split(' ')[0], initials: initials(x.name), avBg: avBg(x.name), xp: x.xp + ' XP' }))
  const leaderboardVM = sortedStudents.map((x, i) => ({ rank: '#' + (i + 1), name: x.name, initials: initials(x.name), avBg: avBg(x.name), xp: x.xp.toLocaleString(), clubsLabel: x.clubs.length + ' clubs' }))

  const electionsVM = ELECTIONS.filter(e => e.open === (electionsTab === 'open')).map(e => {
    const total = e.candidates.reduce((a, c) => a + c[1], 0)
    const max = Math.max(...e.candidates.map(c => c[1]), 1)
    const winner = !e.open ? [...e.candidates].sort((a, b) => b[1] - a[1])[0] : null
    return {
      ...e, total, status: e.open ? 'OPEN' : 'CLOSED',
      statusBg: e.open ? '#e8faf2' : '#eef0f3', statusColor: e.open ? '#10b981' : '#94a0b0',
      isOpen: e.open, hasWinner: !!winner, winner: winner ? winner[0] : '',
      candidates: e.candidates.map(c => {
        const lead = c[1] === max
        return { name: c[0], votes: c[1], pct: total ? Math.round((c[1] / total) * 100) + '%' : '0%', barWidth: (total ? Math.round((c[1] / total) * 100) : 0) + '%', barBg: lead ? 'linear-gradient(90deg,#8b5cf6,#6366f1)' : '#cbd0d8' }
      }),
    }
  })

  const moderationVM = REPORTS.filter(r => !removedReports[r.id])
  const requestsVM = REQUESTS.filter(r => !dismissedRequests[r.id])

  const activeTab = (() => {
    if (screen === 'home') return 'home'
    if (screen === 'clubs' || screen === 'clubDetail') return 'clubs'
    if (screen === 'students' || screen === 'studentProfile') return 'students'
    if (screen === 'chat' || screen === 'chatThread') return 'chat'
    return 'more'
  })()
  const moreActive = moreOpen || ['elections', 'events', 'leaderboard', 'moderation', 'invites', 'settings', 'profile'].includes(screen)
  const showTabBar = !['clubDetail', 'studentProfile', 'chatThread'].includes(screen)
  const tabColor = (on: boolean) => (on ? '#6366f1' : '#9aa0ac')
  const tabW = (on: boolean) => (on ? '2.5' : '2')

  function sendMessage() {
    const text = draft.trim() || SEND_REPLIES[Math.floor(Math.random() * SEND_REPLIES.length)]
    setExtraMessages(st => ({ ...st, [thread.id]: [...(st[thread.id] || []), { sender: 'You', content: text, mine: true }] }))
    setDraft('')
  }

  return (
    <div style={css('position:relative;width:100%;max-width:430px;height:100dvh;margin:0 auto;overflow:hidden;background:#f2f2f7;font-family:var(--font-inter),system-ui,sans-serif;')}>
      <style>{`
        .ios-noscroll::-webkit-scrollbar{display:none}
        .ios-noscroll{scrollbar-width:none;-ms-overflow-style:none}
        @keyframes scIn{from{transform:translateX(14px);opacity:.4}to{transform:translateX(0);opacity:1}}
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}
        @keyframes popIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
      `}</style>

      <div style={css('position:absolute;top:0;left:0;right:0;bottom:0;')}>

        {/* ============ HOME ============ */}
        {screen === 'home' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
                <div>
                  <div style={css('font-size:13px;color:#8a8f9a;font-weight:600;')}>Good morning,</div>
                  <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:25px;letter-spacing:-.03em;color:#0f1729;line-height:1.1;margin-top:1px;")}>Principal Hayes</div>
                  <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>Westfield High School</div>
                </div>
                <div style={css('display:flex;align-items:center;gap:10px;')}>
                  <button onClick={() => showToast('3 new notifications')} style={css('position:relative;width:40px;height:40px;border-radius:14px;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
                    <span style={css('position:absolute;top:7px;right:8px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:1.5px solid #fff;')} />
                  </button>
                  <button onClick={() => nav('profile')} style={css("width:40px;height:40px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366f1,#10b981);color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);cursor:pointer;box-shadow:0 4px 10px rgba(99,102,241,.25);")}>PH</button>
                </div>
              </div>
            </div>

            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 20px 110px;')}>
              {/* VARIANT A: OVERVIEW */}
              {homeVariant === 'A' && (
                <div style={css('animation:fadeIn .3s ease;')}>
                  <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:8px;')}>
                    {[
                      { bg: '#eef0ff', stroke: '#6366f1', icon: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />, num: '8', label: 'Active clubs' },
                      { bg: '#e8faf2', stroke: '#10b981', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>, num: '247', label: 'Students' },
                      { bg: '#fff1e9', stroke: '#f59e0b', icon: <><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" /></>, num: '3', label: 'Pending requests' },
                      { bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />, num: '2', label: 'Open elections' },
                    ].map((s, i) => (
                      <div key={i} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                        <div style={css(`width:34px;height:34px;border-radius:11px;background:${s.bg};display:flex;align-items:center;justify-content:center;margin-bottom:9px;`)}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                        </div>
                        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:26px;color:#0f1729;letter-spacing:-.03em;line-height:1;")}>{s.num}</div>
                        <div style={css('font-size:12px;color:#8a8f9a;font-weight:600;margin-top:3px;')}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VARIANT C: DATA (school pulse) */}
              {homeVariant === 'C' && (
                <>
                  <div style={css('background:#0f1729;border-radius:20px;padding:18px;margin-top:8px;color:#fff;animation:fadeIn .3s ease;box-shadow:0 12px 28px -12px rgba(15,23,41,.5);')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;')}>
                      <div style={css('font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9aa3b8;')}>School pulse · this week</div>
                      <span style={css('font-size:11px;font-weight:700;color:#34d399;background:rgba(52,211,153,.14);padding:3px 8px;border-radius:8px;')}>▲ 12%</span>
                    </div>
                    <div style={css('display:flex;gap:18px;margin-bottom:16px;')}>
                      {[['247', 'Students'], ['82%', 'Engaged'], ['94', 'Avg attend.']].map(([n, l]) => (
                        <div key={l}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:28px;letter-spacing:-.03em;")}>{n}</div><div style={css('font-size:11px;color:#9aa3b8;font-weight:600;')}>{l}</div></div>
                      ))}
                    </div>
                    <div style={css('display:flex;align-items:flex-end;gap:7px;height:64px;')}>
                      {[['M', '38%', false], ['T', '62%', false], ['W', '48%', false], ['T', '88%', true], ['F', '72%', false]].map(([d, h, hot], i) => (
                        <div key={i} style={css('flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;')}>
                          <div style={css(`width:100%;height:${h};background:${hot ? 'linear-gradient(180deg,#818cf8,#34d399)' : 'rgba(255,255,255,.18)'};border-radius:5px;`)} />
                          <span style={css(`font-size:9px;color:${hot ? '#cbd2e0' : '#7b8499'};`)}>{d}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={css('margin-top:18px;display:flex;align-items:center;justify-content:space-between;')}>
                    <div style={css('font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#98a2b3;')}>Club capacity</div>
                    <button onClick={() => nav('clubs')} style={css('font-size:12px;font-weight:600;color:#6366f1;background:none;border:none;cursor:pointer;')}>All clubs</button>
                  </div>
                  <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:6px 16px;margin-top:10px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                    {CLUBS.slice(0, 4).map(c => (
                      <div key={c.id} style={css('display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid #f4f5f7;')}>
                        <span style={css('font-size:19px;width:24px;text-align:center;')}>{c.icon}</span>
                        <span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>{c.name}</span>
                        <div style={css('width:90px;height:7px;border-radius:6px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:linear-gradient(90deg,#6366f1,#10b981);width:${pct(c)}%;`)} /></div>
                        <span style={css('font-size:12px;font-weight:700;color:#8a8f9a;width:44px;text-align:right;')}>{c.count}/{c.cap ?? '∞'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* NEEDS ATTENTION (A + B) */}
              {(homeVariant === 'A' || homeVariant === 'B') && (
                <div style={css('margin-top:22px;')}>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;')}>
                    <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;")}>Needs your attention</div>
                    <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;')}>6 items</span>
                  </div>
                  <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                    {requestsVM.map(r => (
                      <div key={r.id} style={css('display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid #f4f5f7;')}>
                        <span style={css(`width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:var(--font-manrope);flex:none;background:${avBg(r.name)};`)}>{initials(r.name)}</span>
                        <div style={css('flex:1;min-width:0;')}>
                          <div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{r.name}</div>
                          <div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>wants to join {r.club}</div>
                        </div>
                        <button onClick={() => { setDismissedRequests(s => ({ ...s, [r.id]: true })); showToast('Request declined') }} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                        <button onClick={() => { setDismissedRequests(s => ({ ...s, [r.id]: true })); showToast(r.name + ' approved') }} style={css('width:32px;height:32px;border-radius:10px;border:none;background:#10b981;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></button>
                      </div>
                    ))}
                    <button onClick={() => nav('moderation')} style={css('width:100%;display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid #f4f5f7;background:none;border-left:none;border-right:none;border-top:none;cursor:pointer;text-align:left;')}>
                      <span style={css('width:38px;height:38px;border-radius:11px;background:#fff1f2;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg></span>
                      <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>2 reported messages</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Review in moderation</div></div>
                      <Chevron size={18} />
                    </button>
                    <div style={css('display:flex;align-items:center;gap:11px;padding:12px 15px;')}>
                      <span style={css('width:38px;height:38px;border-radius:11px;background:#fef6e7;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg></span>
                      <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>Projector down — Room 204</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Reported by Ms. Patel · 1 open issue</div></div>
                      <button onClick={() => showToast('Issue marked resolved')} style={css('font-size:12px;font-weight:700;color:#10b981;background:#e8faf2;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;')}>Resolve</button>
                    </div>
                  </div>
                </div>
              )}

              {/* QUICK ACTIONS */}
              <div style={css('margin-top:22px;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;margin-bottom:11px;")}>Quick actions</div>
                <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;')}>
                  {[
                    { bg: '#eef0ff', stroke: '#6366f1', icon: <path d="M12 5v14M5 12h14" />, label: 'New club', onClick: () => showToast('New club form opened') },
                    { bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />, label: 'Start election', onClick: () => nav('elections') },
                    { bg: '#e8faf2', stroke: '#10b981', icon: <path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" />, label: 'Invite codes', onClick: () => nav('invites') },
                    { bg: '#fff1e9', stroke: '#f59e0b', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>, label: 'New event', onClick: () => nav('events') },
                  ].map((a, i) => (
                    <button key={i} onClick={a.onClick} style={css('background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:9px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                      <span style={css(`width:36px;height:36px;border-radius:11px;background:${a.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a.stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg></span>
                      <span style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============ CLUBS ============ */}
        {screen === 'clubs' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 10px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Clubs</div>
                <button onClick={() => showToast('New club form opened')} style={css('width:38px;height:38px;border-radius:13px;border:none;background:#0f1729;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
              </div>
              <div style={css('display:flex;align-items:center;gap:9px;background:#e6e6ec;border-radius:12px;padding:9px 13px;')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <span style={css('font-size:14px;color:#8a8f9a;font-weight:500;')}>Search clubs</span>
              </div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:8px 20px 110px;')}>
              {CLUBS.map(c => {
                const full = c.cap !== null && c.count >= c.cap
                return (
                  <button key={c.id} onClick={() => { setCurrentClubId(c.id); setScreen('clubDetail') }} style={css('width:100%;display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:13px;margin-bottom:10px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                    <span style={css(`width:50px;height:50px;border-radius:15px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${c.tint};`)}>{c.icon}</span>
                    <div style={css('flex:1;min-width:0;')}>
                      <div style={css('display:flex;align-items:center;gap:7px;')}>
                        <span style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;letter-spacing:-.01em;")}>{c.name}</span>
                        {full && <span style={css('font-size:9px;font-weight:800;color:#e11d48;background:#ffe4e6;padding:2px 6px;border-radius:6px;letter-spacing:.03em;')}>FULL</span>}
                      </div>
                      <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{c.advisor} · {c.tag}</div>
                      <div style={css('display:flex;align-items:center;gap:8px;margin-top:8px;')}>
                        <div style={css('flex:1;height:6px;border-radius:5px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:5px;background:linear-gradient(90deg,#6366f1,#10b981);width:${pct(c)}%;`)} /></div>
                        <span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;')}>{c.count}/{c.cap ?? '∞'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ============ CLUB DETAIL ============ */}
        {screen === 'clubDetail' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
            <div style={{ ...css(`height:170px;position:relative;flex:none;background:${club.gradient};`) }}>
              <div style={{ position: 'absolute', top: TOP(8), left: '16px' }}><button onClick={() => nav('clubs')} style={css('width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button></div>
              <div style={{ position: 'absolute', top: TOP(8), right: '16px' }}><button onClick={() => showToast('Club management opened')} style={css('height:38px;padding:0 15px;border-radius:19px;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Manage</button></div>
              <div style={css('position:absolute;bottom:-30px;left:20px;width:72px;height:72px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 8px 20px rgba(15,23,42,.18);')}>{club.icon}</div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:42px 20px 40px;')}>
              <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:10px;')}>
                <div>
                  <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.03em;color:#0f1729;")}>{club.name}</div>
                  <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:600;margin-top:2px;')}>Advised by {club.advisor}</div>
                </div>
                <span style={css('font-size:11px;font-weight:800;color:#10b981;background:#e8faf2;padding:5px 10px;border-radius:9px;white-space:nowrap;')}>{club.countLabel}</span>
              </div>
              <p style={css('font-size:13.5px;line-height:1.55;color:#5b6270;font-weight:500;margin:13px 0 0;')}>{club.description}</p>
              <div style={css('display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;')}>
                {club.tags.map(t => <span key={t} style={css('font-size:11.5px;font-weight:600;color:#5b6270;background:#fff;border:1px solid #eef0f3;padding:5px 11px;border-radius:9px;')}>{t}</span>)}
              </div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:5px 16px;margin-top:18px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('display:flex;align-items:center;gap:11px;padding:13px 0;border-bottom:1px solid #f4f5f7;')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{club.meetingDays}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>{club.meetingTime} · {club.location}</div></div>
                </div>
                <div style={css('display:flex;align-items:center;gap:11px;padding:13px 0;')}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5z" /></svg>
                  <div style={css('flex:1;')}><div style={css('font-size:13px;font-weight:700;color:#1f2734;')}>{club.president}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>President</div></div>
                </div>
              </div>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin:20px 4px 11px;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>Members</div>
                <span style={css('font-size:12px;font-weight:600;color:#9aa0ac;')}>{club.countLabel}</span>
              </div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {club.members.map((m, i) => (
                  <div key={i} style={css('display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid #f4f5f7;')}>
                    <span style={css(`width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12.5px;font-family:var(--font-manrope);flex:none;background:${m.avBg};`)}>{m.initials}</span>
                    <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{m.role}</div></div>
                    <Chevron />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ STUDENTS ============ */}
        {screen === 'students' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 10px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;margin-bottom:3px;")}>Students</div>
              <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-bottom:12px;')}>Showing 12 of 247 students</div>
              <div style={css('display:flex;align-items:center;gap:9px;background:#e6e6ec;border-radius:12px;padding:9px 13px;')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <span style={css('font-size:14px;color:#8a8f9a;font-weight:500;')}>Search students</span>
              </div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:8px 20px 110px;')}>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {STUDENTS.map(s => (
                  <button key={s.id} onClick={() => { setCurrentStudentId(s.id); setScreen('studentProfile') }} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:11px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}>
                    <span style={css(`width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:var(--font-manrope);flex:none;background:${avBg(s.name)};`)}>{initials(s.name)}</span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:14px;font-weight:600;color:#1f2734;')}>{s.name}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>{s.clubs.map(c => c[1]).slice(0, 2).join(' · ')}</div></div>
                    <span style={css('font-size:11px;font-weight:800;color:#6366f1;background:#eef0ff;padding:3px 8px;border-radius:8px;')}>{s.xp.toLocaleString()} XP</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ STUDENT PROFILE ============ */}
        {screen === 'studentProfile' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 16px 0;flex:none;'), paddingTop: TOP(14) }}><button onClick={() => nav('students')} style={css('width:38px;height:38px;border-radius:50%;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button></div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:14px 20px 40px;')}>
              <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;')}>
                <span style={css(`width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:var(--font-manrope);background:${student.avBg};box-shadow:0 8px 20px rgba(15,23,42,.15);`)}>{student.initials}</span>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:22px;letter-spacing:-.02em;color:#0f1729;margin-top:13px;")}>{student.name}</div>
                <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{student.email} · {student.grade}</div>
              </div>
              <div style={css('display:flex;gap:11px;margin-top:20px;')}>
                {[[student.xp, 'Total XP'], [student.clubCount, 'Clubs'], [student.attendance, 'Attend.']].map(([v, l], i) => (
                  <div key={i} style={css('flex:1;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:14px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#0f1729;")}>{v}</div><div style={css('font-size:11px;color:#8a8f9a;font-weight:600;margin-top:2px;')}>{l}</div></div>
                ))}
              </div>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;margin:22px 4px 11px;")}>Clubs &amp; roles</div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {student.clubVMs.map((c, i) => (
                  <div key={i} style={css('display:flex;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid #f4f5f7;')}>
                    <span style={css('font-size:22px;width:30px;text-align:center;')}>{c.icon}</span>
                    <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{c.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{c.role}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ CHAT LIST ============ */}
        {screen === 'chat' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 10px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;margin-bottom:12px;")}>Chat</div>
              <div style={css('display:flex;align-items:center;gap:9px;background:#e6e6ec;border-radius:12px;padding:9px 13px;')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                <span style={css('font-size:14px;color:#8a8f9a;font-weight:500;')}>Search messages</span>
              </div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 14px 110px;')}>
              {THREADS.map(t => (
                <button key={t.id} onClick={() => { setCurrentThreadId(t.id); setScreen('chatThread') }} style={css('width:100%;display:flex;align-items:center;gap:13px;padding:12px 8px;border:none;background:none;cursor:pointer;text-align:left;border-bottom:1px solid #ebebf0;')}>
                  <span style={css(`width:52px;height:52px;border-radius:17px;display:flex;align-items:center;justify-content:center;font-size:25px;flex:none;background:${t.tint};`)}>{t.icon}</span>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;')}><span style={css("font-family:var(--font-manrope);font-weight:700;font-size:14.5px;color:#0f1729;")}>{t.name}</span><span style={css('font-size:11px;color:#9aa0ac;font-weight:500;flex:none;')}>{t.time}</span></div>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px;')}><span style={css('font-size:12.5px;color:#8a8f9a;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{t.last}</span>{t.unread > 0 && <span style={css('min-width:19px;height:19px;border-radius:10px;background:#6366f1;color:#fff;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;flex:none;')}>{t.unread}</span>}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============ CHAT THREAD ============ */}
        {screen === 'chatThread' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 14px 11px;background:rgba(242,242,247,.86);backdrop-filter:blur(14px);border-bottom:1px solid #e6e6ec;display:flex;align-items:center;gap:11px;flex:none;z-index:5;'), paddingTop: TOP(12) }}>
              <button onClick={() => nav('chat')} style={css('border:none;background:none;cursor:pointer;padding:2px;')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
              <span style={css(`width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;background:${thread.tint};`)}>{thread.icon}</span>
              <div style={css('flex:1;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;")}>{thread.name}</div><div style={css('font-size:11px;color:#9aa0ac;font-weight:500;')}>{thread.memberCount} members</div></div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:16px 16px 12px;display:flex;flex-direction:column;gap:11px;')}>
              {threadMessages.map((m, i) => (
                <div key={i} style={css(`display:flex;flex-direction:column;align-items:${m.align};`)}>
                  <div style={css(`max-width:80%;display:flex;flex-direction:column;align-items:${m.align};`)}>
                    {m.showName && <span style={css('font-size:10.5px;font-weight:700;color:#9aa0ac;margin:0 0 3px 4px;')}>{m.senderName}</span>}
                    <div style={css(`padding:9px 13px;border-radius:${m.radius};font-size:13.5px;line-height:1.4;font-weight:500;background:${m.bubbleBg};color:${m.bubbleColor};box-shadow:0 1px 1px rgba(16,24,40,.05);`)}>{m.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ ...css('padding:10px 14px 10px;background:rgba(242,242,247,.92);backdrop-filter:blur(14px);border-top:1px solid #e6e6ec;display:flex;align-items:center;gap:9px;flex:none;'), paddingBottom: BOTTOM(18) }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                placeholder="Message…"
                style={css('flex:1;background:#fff;border:1px solid #e2e3e8;border-radius:21px;padding:10px 15px;font-size:13.5px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;')}
              />
              <button onClick={sendMessage} style={css('width:40px;height:40px;border-radius:50%;border:none;background:#6366f1;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" /></svg></button>
            </div>
          </div>
        )}

        {/* ============ ELECTIONS ============ */}
        {screen === 'elections' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 10px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:13px;')}>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Elections</div>
                <button onClick={() => showToast('New election draft')} style={css('height:36px;padding:0 14px;border-radius:18px;border:none;background:#0f1729;color:#fff;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px;')}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>New</button>
              </div>
              <div style={css('display:flex;gap:6px;background:#e6e6ec;border-radius:12px;padding:4px;')}>
                {(['open', 'closed'] as const).map(tab => {
                  const on = electionsTab === tab
                  return <button key={tab} onClick={() => setElectionsTab(tab)} style={css(`flex:1;height:33px;border-radius:9px;border:none;cursor:pointer;font-size:13px;font-weight:700;text-transform:capitalize;background:${on ? '#fff' : 'transparent'};color:${on ? '#0f1729' : '#8a8f9a'};box-shadow:${on ? '0 1px 3px rgba(15,23,41,.12)' : 'none'};`)}>{tab}</button>
                })}
              </div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:10px 20px 110px;')}>
              {electionsVM.map(e => (
                <div key={e.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css('display:flex;align-items:flex-start;justify-content:space-between;gap:8px;')}>
                    <div style={css('flex:1;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15.5px;color:#0f1729;letter-spacing:-.01em;")}>{e.title}</div><div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;line-height:1.4;')}>{e.desc}</div></div>
                    <span style={css(`font-size:10px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:8px;white-space:nowrap;background:${e.statusBg};color:${e.statusColor};`)}>{e.status}</span>
                  </div>
                  {e.hasWinner && <div style={css('font-size:12px;font-weight:700;color:#10b981;background:#e8faf2;border-radius:10px;padding:7px 11px;margin-top:12px;')}>🏆 Winner: {e.winner}</div>}
                  <div style={css('margin-top:13px;display:flex;flex-direction:column;gap:11px;')}>
                    {e.candidates.map((cand, i) => (
                      <div key={i}>
                        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;')}><span style={css('font-size:12.5px;font-weight:600;color:#1f2734;')}>{cand.name}</span><span style={css('font-size:11.5px;font-weight:700;color:#8a8f9a;')}>{cand.votes} · {cand.pct}</span></div>
                        <div style={css('height:8px;border-radius:6px;background:#eef0f3;overflow:hidden;')}><div style={css(`height:100%;border-radius:6px;background:${cand.barBg};width:${cand.barWidth};`)} /></div>
                      </div>
                    ))}
                  </div>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:13px;')}>
                    <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>{e.total} total votes</span>
                    {e.isOpen && <button onClick={() => showToast('Election closed')} style={css('font-size:12px;font-weight:700;color:#64748b;background:#f1f2f4;border:none;padding:6px 12px;border-radius:9px;cursor:pointer;')}>Close election</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ EVENTS ============ */}
        {screen === 'events' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;display:flex;align-items:center;justify-content:space-between;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Events</div>
              <button onClick={() => showToast('New event draft')} style={css('width:38px;height:38px;border-radius:13px;border:none;background:#0f1729;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 20px 110px;')}>
              {EVENTS.map((ev, i) => (
                <div key={i} style={css('display:flex;gap:14px;background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px;margin-bottom:11px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css(`width:50px;flex:none;text-align:center;background:${ev.tint};border-radius:14px;padding:9px 0;`)}><div style={css(`font-size:10px;font-weight:800;color:${ev.accent};letter-spacing:.06em;`)}>{ev.month}</div><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;color:#0f1729;line-height:1;margin-top:2px;")}>{ev.day}</div></div>
                  <div style={css('flex:1;min-width:0;')}>
                    <div style={css('display:flex;align-items:center;gap:6px;')}><span style={css("font-size:14.5px;font-weight:700;color:#0f1729;font-family:var(--font-manrope);")}>{ev.title}</span></div>
                    <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>{ev.club} · {ev.location}</div>
                    <div style={css('display:flex;align-items:center;gap:7px;margin-top:9px;')}><span style={css('font-size:11px;font-weight:700;color:#6366f1;background:#eef0ff;padding:3px 8px;border-radius:7px;')}>{ev.time}</span><span style={css(`font-size:11px;font-weight:700;padding:3px 8px;border-radius:7px;background:${ev.visibility === 'Public' ? '#e8faf2' : '#fff7e6'};color:${ev.visibility === 'Public' ? '#10b981' : '#b45309'};`)}>{ev.visibility}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ LEADERBOARD ============ */}
        {screen === 'leaderboard' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Leaderboard</div>
              <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>Top students by engagement XP this term</div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:4px 20px 110px;')}>
              <div style={css('display:flex;align-items:flex-end;gap:10px;margin:8px 0 18px;')}>
                {/* 2nd */}
                <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}><span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${podium[1]?.avBg};border:3px solid #cbd5e1;`)}>{podium[1]?.initials}</span><div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[1]?.name}</div><div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{podium[1]?.xp}</div><div style={css("width:100%;height:54px;background:linear-gradient(180deg,#e2e5ea,#eef0f3);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:18px;color:#94a0b0;")}>2</div></div>
                {/* 1st */}
                <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}><svg width="20" height="20" viewBox="0 0 24 24" fill="#f59e0b" style={css('margin-bottom:4px;')}><path d="M5 16 3 5l5.5 4L12 4l3.5 5L21 5l-2 11zM5 19h14v2H5z" /></svg><span style={css(`width:62px;height:62px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:19px;font-family:var(--font-manrope);background:${podium[0]?.avBg};border:3px solid #f59e0b;`)}>{podium[0]?.initials}</span><div style={css('font-size:12.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[0]?.name}</div><div style={css('font-size:11px;color:#f59e0b;font-weight:700;')}>{podium[0]?.xp}</div><div style={css("width:100%;height:74px;background:linear-gradient(180deg,#fde68a,#fef3c7);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:22px;color:#d97706;")}>1</div></div>
                {/* 3rd */}
                <div style={css('flex:1;display:flex;flex-direction:column;align-items:center;')}><span style={css(`width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;font-family:var(--font-manrope);background:${podium[2]?.avBg};border:3px solid #e8a87c;`)}>{podium[2]?.initials}</span><div style={css('font-size:11.5px;font-weight:700;color:#1f2734;margin-top:6px;')}>{podium[2]?.name}</div><div style={css('font-size:11px;color:#9aa0ac;font-weight:600;')}>{podium[2]?.xp}</div><div style={css("width:100%;height:42px;background:linear-gradient(180deg,#f0d9c9,#f7ede4);border-radius:12px 12px 0 0;margin-top:8px;display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#b87a52;")}>3</div></div>
              </div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:4px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {leaderboardVM.map((l, i) => (
                  <div key={i} style={css('display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #f4f5f7;')}>
                    <span style={css("width:22px;text-align:center;font-family:var(--font-manrope);font-weight:800;font-size:14px;color:#b3b9c4;")}>{l.rank}</span>
                    <span style={css(`width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12.5px;font-family:var(--font-manrope);flex:none;background:${l.avBg};`)}>{l.initials}</span>
                    <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{l.name}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{l.clubsLabel}</div></div>
                    <span style={css('font-size:12.5px;font-weight:800;color:#6366f1;')}>{l.xp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ MODERATION ============ */}
        {screen === 'moderation' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;display:flex;align-items:center;gap:8px;")}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg>Moderation</div>
              <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Reported chat messages awaiting review</div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 20px 110px;')}>
              {moderationVM.length === 0 && (
                <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:38px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);animation:popIn .25s ease;')}>
                  <div style={css('width:48px;height:48px;border-radius:15px;background:#e8faf2;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" /></svg></div>
                  <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>All clear</div>
                  <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>No open reports to review.</div>
                </div>
              )}
              {moderationVM.map(r => (
                <div key={r.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px;')}>
                    <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Reported by {r.reporter} · {r.time}</span>
                    <span style={css('font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:7px;background:#fef3c7;color:#b45309;')}>{r.reason}</span>
                  </div>
                  <div style={css('background:#f7f8fa;border:1px solid #eef0f3;border-radius:13px;padding:11px 13px;')}>
                    <div style={css('font-size:11px;font-weight:700;color:#9aa0ac;margin-bottom:3px;')}>{r.author} · {r.club}</div>
                    <div style={css('font-size:13.5px;color:#1f2734;font-weight:500;line-height:1.45;')}>{r.content}</div>
                  </div>
                  <div style={css('display:flex;gap:9px;margin-top:12px;')}>
                    <button onClick={() => { setRemovedReports(s => ({ ...s, [r.id]: true })); showToast('Report dismissed') }} style={css('flex:1;height:38px;border-radius:11px;border:1px solid #e7e8ec;background:#fff;color:#475467;font-size:13px;font-weight:700;cursor:pointer;')}>Dismiss</button>
                    <button onClick={() => { setRemovedReports(s => ({ ...s, [r.id]: true })); showToast('Message removed') }} style={css('flex:1;height:38px;border-radius:11px;border:none;background:#ef4444;color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Remove message</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============ INVITE CODES ============ */}
        {screen === 'invites' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;'), paddingTop: TOP(20) }}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Invite codes</div>
              <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Share these so new members can join Westfield High at <span style={css('font-weight:700;color:#6366f1;')}>clubit.app/join</span></div>
            </div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 20px 110px;')}>
              {INVITES.map(iv => {
                const copied = copiedInvite === iv.key
                return (
                  <div key={iv.key} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;')}><span style={css(`font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${iv.accent};`)}>{iv.label}</span><span style={css('font-size:11px;font-weight:600;color:#9aa0ac;')}>{iv.expiry}</span></div>
                    <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                      <code style={css('font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:21px;font-weight:700;letter-spacing:.06em;color:#0f1729;')}>{iv.code}</code>
                      <button onClick={() => { try { navigator.clipboard.writeText(iv.code) } catch { /* noop */ } setCopiedInvite(iv.key); showToast(iv.label + ' code copied') }} style={css(`height:36px;padding:0 14px;border-radius:11px;border:1px solid #e7e8ec;background:${copied ? '#e8faf2' : '#fff'};color:${copied ? '#10b981' : '#475467'};font-size:12.5px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;`)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>{copied ? 'Copied' : 'Copy'}</button>
                    </div>
                  </div>
                )
              })}
              <div style={css('background:#eef0ff;border:1px solid #e0e3ff;border-radius:16px;padding:14px 16px;display:flex;gap:11px;margin-top:4px;')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={css('flex:none;margin-top:1px;')}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                <div style={css('font-size:12.5px;color:#4c4f8a;font-weight:500;line-height:1.5;')}>Codes rotate automatically every 30 days. Regenerate any code instantly if it&apos;s been shared too widely.</div>
              </div>
              <button onClick={() => showToast('All invite codes regenerated')} style={css('width:100%;height:46px;border-radius:14px;border:none;background:#0f1729;color:#fff;font-size:14px;font-weight:700;cursor:pointer;margin-top:14px;')}>Regenerate all codes</button>
            </div>
          </div>
        )}

        {/* ============ SETTINGS ============ */}
        {screen === 'settings' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 20px 14px;background:#f2f2f7;'), paddingTop: TOP(20) }}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>Settings</div></div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:6px 20px 110px;')}>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:14px 16px;display:flex;align-items:center;gap:13px;box-shadow:0 1px 2px rgba(16,24,40,.04);margin-bottom:18px;')}>
                <span style={css("width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#10b981);display:flex;align-items:center;justify-content:center;font-family:var(--font-manrope);font-weight:800;font-size:17px;color:#fff;")}>WH</span>
                <div style={css('flex:1;')}><div style={css("font-family:var(--font-manrope);font-weight:700;font-size:15px;color:#0f1729;")}>Westfield High School</div><div style={css('font-size:12px;color:#9aa0ac;font-weight:500;')}>247 students · 8 clubs · Pro plan</div></div>
                <button onClick={() => showToast('Edit school profile')} style={css('font-size:12.5px;font-weight:700;color:#6366f1;background:#eef0ff;border:none;padding:7px 12px;border-radius:10px;cursor:pointer;')}>Edit</button>
              </div>

              <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:0 4px 9px;')}>Features</div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {([
                  { key: 'leaderboard' as const, bg: '#fff7e6', stroke: '#f59e0b', icon: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0zM8 21h8M12 15v6" />, title: 'Leaderboards', sub: 'Show XP rankings to students' },
                  { key: 'chat' as const, bg: '#eef0ff', stroke: '#6366f1', icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />, title: 'Club chat', sub: 'Allow members to message' },
                  { key: 'push' as const, bg: '#fdecf2', stroke: '#ec4899', icon: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />, title: 'Push notifications', sub: 'Approvals, reports & events' },
                ]).map((row, i, arr) => (
                  <div key={row.key} style={css(`display:flex;align-items:center;gap:12px;padding:13px 0;${i < arr.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css(`width:34px;height:34px;border-radius:10px;background:${row.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={row.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{row.icon}</svg></span>
                    <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{row.title}</div><div style={css('font-size:11px;color:#9aa0ac;')}>{row.sub}</div></div>
                    <button onClick={() => setSettings(s => ({ ...s, [row.key]: !s[row.key] }))} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;background:${settings[row.key] ? '#10b981' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${settings[row.key] ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
                  </div>
                ))}
              </div>

              <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:20px 4px 9px;')}>Account</div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <button onClick={() => nav('invites')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#e8faf2;display:flex;align-items:center;justify-content:center;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Invite codes</span><Chevron /></button>
                <button onClick={() => showToast('Opening billing portal…')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#f3edff;display:flex;align-items:center;justify-content:center;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Billing &amp; subscription</span><Chevron /></button>
                <button onClick={() => showToast('Signing out…')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#fff1f2;display:flex;align-items:center;justify-content:center;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#ef4444;')}>Sign out</span></button>
              </div>
              <div style={css('text-align:center;font-size:11px;color:#b3b9c4;font-weight:500;margin-top:20px;')}>ClubIt for iOS · v2.4.0</div>
            </div>
          </div>
        )}

        {/* ============ PROFILE ============ */}
        {screen === 'profile' && (
          <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
            <div style={{ ...css('padding:0 16px 0;flex:none;display:flex;justify-content:flex-end;'), paddingTop: TOP(14) }}><button onClick={() => nav('settings')} style={css('width:38px;height:38px;border-radius:50%;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;')}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button></div>
            <div className="ios-noscroll" style={css('flex:1;overflow-y:auto;padding:8px 20px 110px;')}>
              <div style={css('display:flex;flex-direction:column;align-items:center;text-align:center;')}>
                <span style={css("width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:30px;font-family:var(--font-manrope);background:linear-gradient(135deg,#6366f1,#10b981);box-shadow:0 10px 24px rgba(99,102,241,.3);")}>PH</span>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;letter-spacing:-.02em;color:#0f1729;margin-top:13px;")}>Principal Hayes</div>
                <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>hayes@westfield.edu</div>
                <span style={css('font-size:11px;font-weight:800;letter-spacing:.05em;color:#e11d48;background:#ffe4e6;padding:5px 12px;border-radius:9px;margin-top:11px;')}>SCHOOL ADMIN</span>
              </div>
              <div style={css('display:flex;gap:11px;margin-top:22px;')}>
                {[['8', 'Clubs managed'], ['247', 'Students'], ['2y', 'On ClubIt']].map(([v, l]) => (
                  <div key={l} style={css('flex:1;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}><div style={css("font-family:var(--font-manrope);font-weight:800;font-size:23px;color:#0f1729;")}>{v}</div><div style={css('font-size:11px;color:#8a8f9a;font-weight:600;margin-top:2px;')}>{l}</div></div>
                ))}
              </div>
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:2px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);margin-top:18px;')}>
                <button onClick={() => nav('moderation')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#fff7e6;display:flex;align-items:center;justify-content:center;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Moderation queue</span><Chevron /></button>
                <button onClick={() => nav('settings')} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;background:none;cursor:pointer;text-align:left;')}><span style={css('width:34px;height:34px;border-radius:10px;background:#eef0ff;display:flex;align-items:center;justify-content:center;')}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82" /></svg></span><span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>Settings</span><Chevron /></button>
              </div>
            </div>
          </div>
        )}

        {/* ============ MORE DRAWER ============ */}
        {moreOpen && (
          <div style={css('position:absolute;inset:0;z-index:80;')}>
            <div onClick={() => setMoreOpen(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
            <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 16px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(34) }}>
              <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 14px;')} />
              <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;')}>
                {[
                  { bg: '#fff1e9', stroke: '#f59e0b', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>, label: 'Events', onClick: () => nav('events') },
                  { bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />, label: 'Elections', onClick: () => nav('elections') },
                  { bg: '#fff7e6', stroke: '#f59e0b', icon: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0zM8 21h8M12 15v6" />, label: 'Leaderboard', onClick: () => nav('leaderboard') },
                  { bg: '#fff1f2', stroke: '#ef4444', icon: <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" />, label: 'Moderation', onClick: () => nav('moderation'), badge: moderationVM.length },
                  { bg: '#e8faf2', stroke: '#10b981', icon: <path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" />, label: 'Invite codes', onClick: () => nav('invites') },
                  { bg: '#eef0f3', stroke: '#64748b', icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82M4.6 9a1.65 1.65 0 0 0-.33-1.82" /></>, label: 'Settings', onClick: () => nav('settings') },
                ].map((m, i) => (
                  <button key={i} onClick={m.onClick} style={css('background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;display:flex;align-items:center;gap:11px;cursor:pointer;text-align:left;position:relative;')}>
                    <span style={css(`width:38px;height:38px;border-radius:11px;background:${m.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={m.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg></span>
                    <span style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{m.label}</span>
                    {m.badge ? <span style={css('position:absolute;top:12px;right:12px;min-width:18px;height:18px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 5px;')}>{m.badge}</span> : null}
                  </button>
                ))}
              </div>
              <button onClick={() => nav('profile')} style={css('width:100%;margin-top:11px;background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:13px 15px;display:flex;align-items:center;gap:12px;cursor:pointer;text-align:left;')}>
                <span style={css("width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#10b981);color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);display:flex;align-items:center;justify-content:center;")}>PH</span>
                <div style={css('flex:1;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>Principal Hayes</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>View profile · School admin</div></div>
                <Chevron size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============ TOAST ============ */}
        {toast && (
          <div style={{ ...css('position:absolute;left:50%;transform:translateX(-50%);z-index:90;background:#0f1729;color:#fff;font-size:13px;font-weight:600;padding:11px 18px;border-radius:14px;box-shadow:0 10px 26px rgba(15,23,41,.32);white-space:nowrap;animation:toastIn .26s cubic-bezier(.32,.72,0,1);display:flex;align-items:center;gap:8px;'), bottom: `calc(${BOTTOM(0)} + 96px)` }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>{toast}
          </div>
        )}
      </div>

      {/* ============ TAB BAR ============ */}
      {showTabBar && (
        <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;z-index:70;background:rgba(248,248,250,.86);backdrop-filter:blur(20px);border-top:1px solid #e2e2e8;'), paddingBottom: BOTTOM(18) }}>
          <div style={css('display:flex;align-items:stretch;height:52px;')}>
            <button onClick={() => nav('home')} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(activeTab === 'home')};`)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(activeTab === 'home')} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg><span style={css('font-size:10px;font-weight:600;')}>Home</span></button>
            <button onClick={() => nav('clubs')} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(activeTab === 'clubs')};`)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(activeTab === 'clubs')} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><polygon points="16.2 7.8 14.1 14.1 7.8 16.2 9.9 9.9" /></svg><span style={css('font-size:10px;font-weight:600;')}>Clubs</span></button>
            <button onClick={() => nav('students')} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(activeTab === 'students')};`)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(activeTab === 'students')} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg><span style={css('font-size:10px;font-weight:600;')}>Students</span></button>
            <button onClick={() => nav('chat')} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(activeTab === 'chat')};position:relative;`)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(activeTab === 'chat')} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg><span style={css('font-size:10px;font-weight:600;')}>Chat</span><span style={css('position:absolute;top:1px;right:50%;margin-right:-17px;min-width:16px;height:16px;border-radius:8px;background:#ef4444;color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;')}>3</span></button>
            <button onClick={() => setMoreOpen(true)} style={css(`flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:none;background:none;cursor:pointer;color:${tabColor(moreActive)};`)}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={tabW(moreActive)} strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg><span style={css('font-size:10px;font-weight:600;')}>More</span></button>
          </div>
        </div>
      )}
    </div>
  )
}
