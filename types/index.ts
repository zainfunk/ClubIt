export type Role = 'superadmin' | 'admin' | 'advisor' | 'student'

export type SchoolStatus = 'pending' | 'active' | 'suspended' | 'payment_paused'

export interface School {
  id: string
  name: string
  district?: string
  contactName: string
  contactEmail: string
  status: SchoolStatus
  studentInviteCode?: string
  adminInviteCode?: string
  advisorInviteCode?: string
  setupToken?: string
  setupTokenExpiresAt?: string
  setupCompletedAt?: string
  createdAt: string
  studentCodeExpiresAt?: string
  advisorCodeExpiresAt?: string
  adminCodeExpiresAt?: string
}

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
  schoolId?: string
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

export interface AttendanceSession {
  id: string
  clubId: string
  meetingDate: string        // YYYY-MM-DD
  createdBy: string          // advisorId
  expiresAt: string          // ISO timestamp
  maxDistanceMeters: number  // 0 = no restriction
  advisorLat?: number
  advisorLng?: number
  recordedUserIds: string[]  // users who already checked in
}

export interface SchoolElection {
  id: string
  positionTitle: string
  description: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
}

export interface ChatMessage {
  id: string
  clubId: string
  senderId: string
  content: string
  sentAt: string // ISO timestamp
}

export interface Notification {
  id: string
  userId: string
  schoolId?: string
  type: string
  title: string
  body?: string
  link?: string
  isRead: boolean
  createdAt: string
}

// --- Billing & Subscriptions ---

export type SubscriptionPlan = 'monthly' | 'yearly'
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'

export interface SubscriptionInfo {
  id: string
  schoolId: string
  stripeCustomerId: string
  stripeSubscriptionId?: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  trialEndsAt?: string
  currentPeriodStart?: string
  currentPeriodEnd?: string
  cancelAtPeriodEnd: boolean
  createdAt: string
  updatedAt: string
}

export interface PaymentEvent {
  id: string
  schoolId?: string
  stripeEventId: string
  eventType: string
  amountCents?: number
  currency: string
  status: string
  createdAt: string
}

export type ClubFormType = 'signup' | 'nomination' | 'survey' | 'approval'

export interface ClubForm {
  id: string
  clubId: string
  title: string
  description: string
  formType: ClubFormType
  isOpen: boolean
  closesAt: string | null
  createdAt: string
}
