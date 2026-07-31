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
  xpTotal?: number
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
  duesAmountCents: number // 0 = no dues collected
}

export interface ClubDuesPayment {
  id: string
  clubId: string
  userId: string
  paid: boolean
  paidAt?: string
  amountCents: number
  markedBy?: string
  updatedAt: string
}

export interface Membership {
  id: string
  clubId: string
  userId: string
  joinedAt: string
  hoursAdjustmentMinutes?: number
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
  durationMinutes?: number
}

export interface UserBadge {
  id: string
  userId: string
  badgeKey: string
  earnedAt: string
  clubId?: string
}

// --- Polls & Elections ---
//
// As of W2.2 (secret ballot) the server NEVER returns voter identities
// to the browser. `votes: string[]` (array of voter user IDs) is gone;
// in its place are aggregated counts and a per-caller "did I vote, and
// for whom" pointer.

export interface PollCandidate {
  userId: string
  voteCount: number
}

export interface Poll {
  id: string
  clubId: string
  positionTitle: string
  candidates: PollCandidate[]
  createdAt: string
  isOpen: boolean
  /** The caller's own vote in this poll, if any. null = haven't voted. */
  myVoteCandidateId?: string | null
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
  /** The caller's own vote in this election, if any. null = haven't voted. */
  myVoteCandidateId?: string | null
}

export interface ChatChannel {
  id: string
  clubId: string
  name: string
  createdBy: string | null
  createdAt: string
}

export interface ChatMessage {
  id: string
  clubId: string
  channelId: string | null
  senderId: string
  content: string
  sentAt: string // ISO timestamp
}

export interface ClubDocument {
  id: string
  name: string
  contentType: string
  sizeBytes: number
  uploadedBy: string
  createdAt: string
  url: string | null // short-lived signed download URL
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

export type ClubRegistrationStatus = 'pending' | 'approved' | 'denied'

export type RequesterRole = 'president' | 'officer'

export interface ClubRegistrationRequest {
  id: string
  schoolId: string
  requesterId: string
  clubName: string
  description: string
  category: string | null
  expectedMembers: number | null
  requesterRole: RequesterRole | null
  contactInfo: string | null
  status: ClubRegistrationStatus
  denialReason: string | null
  reviewerId: string | null
  reviewedAt: string | null
  createdClubId: string | null
  createdAt: string
  updatedAt: string
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
