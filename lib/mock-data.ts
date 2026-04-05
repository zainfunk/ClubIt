import { Club, User, Membership, ClubEvent } from '@/types'

export const USERS: User[] = [
  {
    id: 'user-admin-1',
    name: 'Principal Hayes',
    email: 'hayes@schoolsolver.edu',
    role: 'admin',
  },
  {
    id: 'user-advisor-1',
    name: 'Ms. Patel',
    email: 'patel@schoolsolver.edu',
    role: 'advisor',
  },
  {
    id: 'user-advisor-2',
    name: 'Mr. Thompson',
    email: 'thompson@schoolsolver.edu',
    role: 'advisor',
  },
  {
    id: 'user-student-1',
    name: 'Alex Rivera',
    email: 'alex@schoolsolver.edu',
    role: 'student',
  },
  {
    id: 'user-student-2',
    name: 'Jordan Kim',
    email: 'jordan@schoolsolver.edu',
    role: 'student',
  },
  {
    id: 'user-student-3',
    name: 'Sam Okafor',
    email: 'sam@schoolsolver.edu',
    role: 'student',
  },
]

export const CLUBS: Club[] = [
  {
    id: 'club-robotics',
    name: 'Robotics Club',
    description:
      'Build and program robots to compete in regional and national competitions. No experience required — just curiosity and drive.',
    iconUrl: '🤖',
    capacity: 20,
    advisorId: 'user-advisor-1',
    memberIds: ['user-student-1', 'user-student-2'],
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
      { dayOfWeek: 2, startTime: '15:00', endTime: '16:30', location: 'Room 204' },
      { dayOfWeek: 4, startTime: '15:00', endTime: '16:30', location: 'Room 204' },
    ],
    tags: ['STEM', 'Engineering', 'Competition'],
    createdAt: '2024-09-01',
  },
  {
    id: 'club-drama',
    name: 'Drama Club',
    description:
      'Perform in school plays and musicals, develop stage presence, and explore the world of theatre. Open to all skill levels.',
    iconUrl: '🎭',
    capacity: 30,
    advisorId: 'user-advisor-2',
    memberIds: ['user-student-2', 'user-student-3'],
    leadershipPositions: [
      { id: 'lp-4', title: 'President', userId: 'user-student-3' },
      { id: 'lp-5', title: 'Stage Manager', userId: undefined },
    ],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
    ],
    meetingTimes: [
      { dayOfWeek: 1, startTime: '14:30', endTime: '16:00', location: 'Auditorium' },
      { dayOfWeek: 3, startTime: '14:30', endTime: '16:00', location: 'Auditorium' },
    ],
    tags: ['Arts', 'Performance', 'Theatre'],
    createdAt: '2024-09-01',
  },
  {
    id: 'club-chess',
    name: 'Chess Club',
    description:
      'Sharpen your strategy and compete against other schools. Beginners welcome — experienced members will help you learn.',
    iconUrl: '♟️',
    capacity: 15,
    advisorId: 'user-advisor-1',
    memberIds: ['user-student-1', 'user-student-3'],
    leadershipPositions: [
      { id: 'lp-6', title: 'President', userId: 'user-student-1' },
      { id: 'lp-7', title: 'Tournament Coordinator', userId: undefined },
    ],
    socialLinks: [],
    meetingTimes: [
      { dayOfWeek: 3, startTime: '15:00', endTime: '16:00', location: 'Library' },
    ],
    tags: ['Strategy', 'Competition', 'Games'],
    createdAt: '2024-09-01',
  },
  {
    id: 'club-environment',
    name: 'Environmental Club',
    description:
      'Take action on sustainability, organize campus clean-ups, and raise awareness about environmental issues in our community.',
    iconUrl: '🌱',
    capacity: 25,
    advisorId: 'user-advisor-2',
    memberIds: ['user-student-2'],
    leadershipPositions: [
      { id: 'lp-8', title: 'President', userId: undefined },
      { id: 'lp-9', title: 'Events Coordinator', userId: 'user-student-2' },
    ],
    socialLinks: [
      { platform: 'instagram', url: 'https://instagram.com' },
      { platform: 'twitter', url: 'https://twitter.com' },
    ],
    meetingTimes: [
      { dayOfWeek: 5, startTime: '12:00', endTime: '13:00', location: 'Room 101' },
    ],
    tags: ['Environment', 'Community', 'Activism'],
    createdAt: '2024-09-01',
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
  },
  {
    id: 'event-2',
    clubId: 'club-drama',
    title: 'Spring Musical — Auditions',
    description: 'Auditions for this year\'s spring musical. Open to all students.',
    date: '2026-04-15',
    location: 'Main Auditorium',
    isPublic: true,
  },
  {
    id: 'event-3',
    clubId: 'club-chess',
    title: 'Interschool Chess Tournament',
    description: 'Home tournament — we\'re hosting 6 schools this year.',
    date: '2026-05-03',
    location: 'Library',
    isPublic: true,
  },
  {
    id: 'event-4',
    clubId: 'club-environment',
    title: 'Earth Day Campus Clean-Up',
    description: 'Join us for our annual Earth Day clean-up. All students welcome.',
    date: '2026-04-22',
    location: 'School Grounds',
    isPublic: true,
  },
]

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
