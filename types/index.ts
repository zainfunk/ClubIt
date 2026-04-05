export type Role = 'admin' | 'advisor' | 'student'

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

export interface SocialLink {
  platform: 'instagram' | 'twitter' | 'discord' | 'facebook' | 'website' | 'other'
  url: string
}

export interface MeetingTime {
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
  capacity: number
  advisorId: string
  memberIds: string[]
  leadershipPositions: LeadershipPosition[]
  socialLinks: SocialLink[]
  meetingTimes: MeetingTime[]
  tags?: string[]
  createdAt: string
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
}

export interface AttendanceRecord {
  id: string
  clubId: string
  userId: string
  meetingDate: string
  present: boolean
}
