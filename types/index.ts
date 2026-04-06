export type Role = 'admin' | 'advisor' | 'student'

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected'

export interface JoinRequest {
  id: string
  clubId: string
  userId: string
  requestedAt: string
  status: JoinRequestStatus
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl?: string
}

export interface LeadershipPosition {
  id: string
  title: string
  userId?: string
}

export type SocialPlatform = 'instagram' | 'twitter' | 'discord' | 'facebook' | 'youtube' | 'website' | 'other'

export interface SocialLink {
  platform: SocialPlatform
  url: string
}

export interface MeetingTime {
  id: string
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string
  endTime: string
  location?: string
}

export interface Club {
  id: string
  name: string
  description: string
  iconUrl?: string
  capacity: number | null // null = unlimited
  advisorId: string
  memberIds: string[]
  eventCreatorIds: string[] // member IDs granted event/news creation by advisor
  leadershipPositions: LeadershipPosition[]
  socialLinks: SocialLink[]
  meetingTimes: MeetingTime[]
  tags?: string[]
  createdAt: string
  autoAccept: boolean
}

export interface Membership {
  id: string
  clubId: string
  userId: string
  joinedAt: string
}

export interface ClubEvent {
  id: string
  clubId: string
  title: string
  description: string
  date: string
  location?: string
  isPublic: boolean
  createdBy: string // userId of creator
}

export interface ClubNews {
  id: string
  clubId: string
  title: string
  content: string
  authorId: string
  createdAt: string
  isPinned: boolean
}

export interface AttendanceRecord {
  id: string
  clubId: string
  userId: string
  meetingDate: string
  present: boolean
}

// --- Polls & Elections ---

export interface PollCandidate {
  userId: string
  votes: string[]
}

export interface Poll {
  id: string
  clubId: string
  positionTitle: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
}

export interface SchoolElection {
  id: string
  positionTitle: string
  description: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
}
