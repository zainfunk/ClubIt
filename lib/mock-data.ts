import { Club, User, Membership, ClubEvent, JoinRequest, AttendanceRecord, Poll, SchoolElection, ClubNews } from '@/types'

export const USERS: User[] = [
  { id: 'user-admin-1', name: 'Principal Hayes', email: 'hayes@schoolsolver.edu', role: 'admin' },
  { id: 'user-advisor-1', name: 'Ms. Patel', email: 'patel@schoolsolver.edu', role: 'advisor' },
  { id: 'user-advisor-2', name: 'Mr. Thompson', email: 'thompson@schoolsolver.edu', role: 'advisor' },
  { id: 'user-student-1', name: 'Alex Rivera', email: 'alex@schoolsolver.edu', role: 'student' },
  { id: 'user-student-2', name: 'Jordan Kim', email: 'jordan@schoolsolver.edu', role: 'student' },
  { id: 'user-student-3', name: 'Sam Okafor', email: 'sam@schoolsolver.edu', role: 'student' },
]

export const CLUBS: Club[] = [
  {
    id: 'club-robotics',
    name: 'Robotics Club',
    description: 'Build and program robots to compete in regional and national competitions. No experience required — just curiosity and drive.',
    iconUrl: '🤖',
    capacity: 20,
    advisorId: 'user-advisor-1',
    memberIds: ['user-student-1', 'user-student-2'],
    eventCreatorIds: ['user-student-1'], // President can create events
    leadershipPositions: [
      { id: 'lp-1', title: 'President', userId: 'user-student-1' },
      { id: 'lp-2', title: 'Vice President', userId: 'user-student-2' },
      { id: 'lp-3', title: 'Build Lead', userId: undefined },
    ],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'discord', url: 'https://discord.com' },
    ],
    meetingTimes: [
      { id: 'mt-1', dayOfWeek: 2, startTime: '15:00', endTime: '16:30', location: 'Room 204' },
      { id: 'mt-2', dayOfWeek: 4, startTime: '15:00', endTime: '16:30', location: 'Room 204' },
    ],
    tags: ['STEM', 'Engineering', 'Competition'],
    createdAt: '2024-09-01',
    autoAccept: true,
  },
  {
    id: 'club-drama',
    name: 'Drama Club',
    description: 'Perform in school plays and musicals, develop stage presence, and explore the world of theatre. Open to all skill levels.',
    iconUrl: '🎭',
    capacity: 30,
    advisorId: 'user-advisor-2',
    memberIds: ['user-student-2', 'user-student-3'],
    eventCreatorIds: ['user-student-3'], // President can create events
    leadershipPositions: [
      { id: 'lp-4', title: 'President', userId: 'user-student-3' },
      { id: 'lp-5', title: 'Stage Manager', userId: undefined },
    ],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
    ],
    meetingTimes: [
      { id: 'mt-3', dayOfWeek: 1, startTime: '14:30', endTime: '16:00', location: 'Auditorium' },
      { id: 'mt-4', dayOfWeek: 3, startTime: '14:30', endTime: '16:00', location: 'Auditorium' },
    ],
    tags: ['Arts', 'Performance', 'Theatre'],
    createdAt: '2024-09-01',
    autoAccept: false,
  },
  {
    id: 'club-chess',
    name: 'Chess Club',
    description: 'Sharpen your strategy and compete against other schools. Beginners welcome — experienced members will help you learn.',
    iconUrl: '♟️',
    capacity: null,
    advisorId: 'user-advisor-1',
    memberIds: ['user-student-1', 'user-student-3'],
    eventCreatorIds: [],
    leadershipPositions: [
      { id: 'lp-6', title: 'President', userId: 'user-student-1' },
      { id: 'lp-7', title: 'Tournament Coordinator', userId: undefined },
    ],
    socialLinks: [],
    meetingTimes: [
      { id: 'mt-5', dayOfWeek: 3, startTime: '15:00', endTime: '16:00', location: 'Library' },
    ],
    tags: ['Strategy', 'Competition', 'Games'],
    createdAt: '2024-09-01',
    autoAccept: false,
  },
  {
    id: 'club-environment',
    name: 'Environmental Club',
    description: 'Take action on sustainability, organize campus clean-ups, and raise awareness about environmental issues in our community.',
    iconUrl: '🌱',
    capacity: 25,
    advisorId: 'user-advisor-2',
    memberIds: ['user-student-2'],
    eventCreatorIds: ['user-student-2'],
    leadershipPositions: [
      { id: 'lp-8', title: 'President', userId: undefined },
      { id: 'lp-9', title: 'Events Coordinator', userId: 'user-student-2' },
    ],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'twitter', url: 'https://twitter.com' },
    ],
    meetingTimes: [
      { id: 'mt-6', dayOfWeek: 5, startTime: '12:00', endTime: '13:00', location: 'Room 101' },
    ],
    tags: ['Environment', 'Community', 'Activism'],
    createdAt: '2024-09-01',
    autoAccept: true,
  },
]

export const MEMBERSHIPS: Membership[] = [
  { id: 'm-1', clubId: 'club-robotics', userId: 'user-student-1', joinedAt: '2024-09-05' },
  { id: 'm-2', clubId: 'club-robotics', userId: 'user-student-2', joinedAt: '2024-09-05' },
  { id: 'm-3', clubId: 'club-drama', userId: 'user-student-2', joinedAt: '2024-09-06' },
  { id: 'm-4', clubId: 'club-drama', userId: 'user-student-3', joinedAt: '2024-09-06' },
  { id: 'm-5', clubId: 'club-chess', userId: 'user-student-1', joinedAt: '2024-09-07' },
  { id: 'm-6', clubId: 'club-chess', userId: 'user-student-3', joinedAt: '2024-09-07' },
  { id: 'm-7', clubId: 'club-environment', userId: 'user-student-2', joinedAt: '2024-09-08' },
]

export const EVENTS: ClubEvent[] = [
  {
    id: 'event-1',
    clubId: 'club-robotics',
    title: 'Regional Robotics Qualifier',
    description: 'Compete against 12 other schools in the regional qualifier round.',
    date: '2026-04-20',
    location: 'Westfield High Gymnasium',
    isPublic: true,
    createdBy: 'user-advisor-1',
  },
  {
    id: 'event-2',
    clubId: 'club-drama',
    title: 'Spring Musical — Auditions',
    description: "Auditions for this year's spring musical. Open to all students.",
    date: '2026-04-15',
    location: 'Main Auditorium',
    isPublic: true,
    createdBy: 'user-advisor-2',
  },
  {
    id: 'event-3',
    clubId: 'club-chess',
    title: 'Interschool Chess Tournament',
    description: "Home tournament — we're hosting 6 schools this year.",
    date: '2026-05-03',
    location: 'Library',
    isPublic: true,
    createdBy: 'user-advisor-1',
  },
  {
    id: 'event-4',
    clubId: 'club-environment',
    title: 'Earth Day Campus Clean-Up',
    description: 'Join us for our annual Earth Day clean-up. All students welcome.',
    date: '2026-04-22',
    location: 'School Grounds',
    isPublic: true,
    createdBy: 'user-student-2',
  },
  {
    id: 'event-5',
    clubId: 'club-robotics',
    title: 'Build Workshop',
    description: 'Internal workshop for members to work on the robot chassis.',
    date: '2026-04-10',
    location: 'Room 204',
    isPublic: false,
    createdBy: 'user-student-1',
  },
]

export const JOIN_REQUESTS: JoinRequest[] = [
  { id: 'req-1', clubId: 'club-robotics', userId: 'user-student-3', requestedAt: '2026-04-01T09:15:00Z', status: 'pending' },
  { id: 'req-2', clubId: 'club-drama', userId: 'user-student-1', requestedAt: '2026-04-02T10:30:00Z', status: 'pending' },
  { id: 'req-3', clubId: 'club-chess', userId: 'user-student-2', requestedAt: '2026-04-01T14:00:00Z', status: 'pending' },
  { id: 'req-4', clubId: 'club-environment', userId: 'user-student-1', requestedAt: '2026-04-03T08:00:00Z', status: 'pending' },
  { id: 'req-5', clubId: 'club-environment', userId: 'user-student-3', requestedAt: '2026-04-03T11:45:00Z', status: 'pending' },
]

export const ATTENDANCE_RECORDS: AttendanceRecord[] = [
  { id: 'att-1', clubId: 'club-robotics', userId: 'user-student-1', meetingDate: '2026-03-19', present: true },
  { id: 'att-2', clubId: 'club-robotics', userId: 'user-student-2', meetingDate: '2026-03-19', present: false },
  { id: 'att-3', clubId: 'club-robotics', userId: 'user-student-1', meetingDate: '2026-03-24', present: true },
  { id: 'att-4', clubId: 'club-robotics', userId: 'user-student-2', meetingDate: '2026-03-24', present: true },
  { id: 'att-5', clubId: 'club-robotics', userId: 'user-student-1', meetingDate: '2026-03-26', present: true },
  { id: 'att-6', clubId: 'club-robotics', userId: 'user-student-2', meetingDate: '2026-03-26', present: true },
  { id: 'att-7', clubId: 'club-drama', userId: 'user-student-2', meetingDate: '2026-03-16', present: true },
  { id: 'att-8', clubId: 'club-drama', userId: 'user-student-3', meetingDate: '2026-03-16', present: true },
  { id: 'att-9', clubId: 'club-drama', userId: 'user-student-2', meetingDate: '2026-03-18', present: false },
  { id: 'att-10', clubId: 'club-drama', userId: 'user-student-3', meetingDate: '2026-03-18', present: true },
  { id: 'att-11', clubId: 'club-chess', userId: 'user-student-1', meetingDate: '2026-03-18', present: true },
  { id: 'att-12', clubId: 'club-chess', userId: 'user-student-3', meetingDate: '2026-03-18', present: false },
  { id: 'att-13', clubId: 'club-chess', userId: 'user-student-1', meetingDate: '2026-03-25', present: true },
  { id: 'att-14', clubId: 'club-chess', userId: 'user-student-3', meetingDate: '2026-03-25', present: true },
  { id: 'att-15', clubId: 'club-environment', userId: 'user-student-2', meetingDate: '2026-03-20', present: true },
  { id: 'att-16', clubId: 'club-environment', userId: 'user-student-2', meetingDate: '2026-03-27', present: false },
]

export const CLUB_NEWS: ClubNews[] = [
  {
    id: 'news-1',
    clubId: 'club-robotics',
    title: 'Qualifier Prep Starts Monday',
    content: 'All members please come prepared with your build notes. We will be doing a full run-through of the competition routine before the qualifier on April 20.',
    authorId: 'user-advisor-1',
    createdAt: '2026-04-04T08:00:00Z',
    isPinned: true,
  },
  {
    id: 'news-2',
    clubId: 'club-robotics',
    title: 'New Parts Arrived',
    content: 'The replacement servo motors and sensor kits have arrived. Pick them up from Room 204 before our next session.',
    authorId: 'user-student-1',
    createdAt: '2026-04-02T14:00:00Z',
    isPinned: false,
  },
  {
    id: 'news-3',
    clubId: 'club-drama',
    title: 'Audition Slots Open',
    content: 'Sign-up sheet for audition slots is now available outside the auditorium. Slots fill up fast — grab yours by Friday!',
    authorId: 'user-advisor-2',
    createdAt: '2026-04-03T09:30:00Z',
    isPinned: true,
  },
]

export const POLLS: Poll[] = [
  {
    id: 'poll-1',
    clubId: 'club-robotics',
    positionTitle: 'Build Lead',
    candidates: [
      { userId: 'user-student-1', votes: [] },
      { userId: 'user-student-2', votes: [] },
    ],
    createdAt: '2026-04-04T10:00:00Z',
    isOpen: true,
  },
]

export const SCHOOL_ELECTIONS = [
  {
    id: 'selec-1',
    positionTitle: 'Student Body President',
    description: "Vote for next year's Student Body President.",
    candidates: [
      { userId: 'user-student-1', votes: ['user-student-2'] },
      { userId: 'user-student-3', votes: [] },
    ],
    createdAt: '2026-04-01T09:00:00Z',
    isOpen: true,
  },
  {
    id: 'selec-2',
    positionTitle: 'Student Body Treasurer',
    description: "Vote for next year's Student Body Treasurer.",
    candidates: [
      { userId: 'user-student-2', votes: [] },
      { userId: 'user-student-3', votes: [] },
    ],
    createdAt: '2026-04-01T09:05:00Z',
    isOpen: true,
  },
]

// --- Helpers ---

export function getUserById(id: string): User | undefined {
  return USERS.find((u) => u.id === id)
}

export function getClubById(id: string): Club | undefined {
  return CLUBS.find((c) => c.id === id)
}

export function getClubsByMember(userId: string): Club[] {
  return CLUBS.filter((c) => c.memberIds.includes(userId))
}

export function getClubsByAdvisor(userId: string): Club[] {
  return CLUBS.filter((c) => c.advisorId === userId)
}

export function getEventsByClub(clubId: string): ClubEvent[] {
  return EVENTS.filter((e) => e.clubId === clubId)
}

export function getAttendanceByClub(clubId: string): AttendanceRecord[] {
  return ATTENDANCE_RECORDS.filter((r) => r.clubId === clubId)
}

export function getRequestsByClub(clubId: string): JoinRequest[] {
  return JOIN_REQUESTS.filter((r) => r.clubId === clubId)
}

export function getPollsByClub(clubId: string): Poll[] {
  return POLLS.filter((p) => p.clubId === clubId)
}

export function getNewsByClub(clubId: string): ClubNews[] {
  return CLUB_NEWS.filter((n) => n.clubId === clubId).sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}
