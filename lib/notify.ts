import 'server-only'
import { createServiceClient } from '@/lib/supabase'
import { sendPushToUser, sendPushToUsers } from '@/lib/push-send'

/**
 * Push-notification fan-out for app events.
 *
 * Every function here is best-effort and self-contained: it resolves its own
 * recipients via the service-role client and swallows its own errors, so callers
 * can fire it from a Next.js `after()` callback without it ever affecting the
 * response. When APNs isn't configured (`pushConfigured()` is false) the
 * underlying sender no-ops, so these are safe to call in prod today.
 */

/** Trim a chat/news body to a notification-friendly length. */
function preview(text: string, max = 120): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean
}

/** Look up a user's display name (override first, then base), for use in copy. */
async function displayName(db: ReturnType<typeof createServiceClient>, userId: string): Promise<string> {
  const [{ data: override }, { data: user }] = await Promise.all([
    db.from('user_overrides').select('name').eq('user_id', userId).maybeSingle(),
    db.from('users').select('name').eq('id', userId).maybeSingle(),
  ])
  return (override?.name?.trim() || user?.name?.trim() || 'Someone')
}

/**
 * New chat message → notify the other members of the club (members + advisor),
 * excluding the sender and anyone who has blocked the sender (they can't see the
 * message, so they shouldn't be pinged about it — Guideline 1.2).
 */
export async function notifyNewChatMessage(opts: {
  clubId: string
  senderId: string
  content: string
}): Promise<void> {
  try {
    const db = createServiceClient()

    const [{ data: club }, { data: members }, { data: blocks }] = await Promise.all([
      db.from('clubs').select('name, advisor_id').eq('id', opts.clubId).maybeSingle(),
      db.from('memberships').select('user_id').eq('club_id', opts.clubId),
      db.from('user_blocks').select('blocker_id').eq('blocked_id', opts.senderId),
    ])
    if (!club) return

    const blockers = new Set((blocks ?? []).map((b) => b.blocker_id as string))
    const recipients = new Set<string>()
    for (const m of members ?? []) recipients.add(m.user_id as string)
    if (club.advisor_id) recipients.add(club.advisor_id as string)
    recipients.delete(opts.senderId)
    for (const id of blockers) recipients.delete(id)
    if (recipients.size === 0) return

    const senderName = await displayName(db, opts.senderId)
    await sendPushToUsers(Array.from(recipients), {
      title: `${senderName} · ${club.name}`,
      body: preview(opts.content),
      path: `/chat/${opts.clubId}`,
    })
  } catch (err) {
    console.warn('[notify] chat message push failed', err)
  }
}

/**
 * Election opened → notify everyone in the school (so they can vote), except the
 * admin who created it.
 */
export async function notifyElectionOpened(opts: {
  schoolId: string
  electionId: string
  positionTitle: string
  creatorId: string
}): Promise<void> {
  try {
    const db = createServiceClient()
    const { data: users } = await db
      .from('users')
      .select('id')
      .eq('school_id', opts.schoolId)

    const recipients = (users ?? [])
      .map((u) => u.id as string)
      .filter((id) => id !== opts.creatorId)
    if (recipients.length === 0) return

    await sendPushToUsers(recipients, {
      title: 'New election open',
      body: `Vote now: ${opts.positionTitle}`,
      path: `/elections/${opts.electionId}`,
    })
  } catch (err) {
    console.warn('[notify] election push failed', err)
  }
}

/**
 * New event posted → notify the club's members (and advisor), excluding the
 * creator. (Time-based reminders are handled separately by the
 * /api/cron/event-reminders job.)
 */
export async function notifyNewEvent(opts: {
  clubId: string
  eventId: string
  title: string
  creatorId: string
}): Promise<void> {
  try {
    const db = createServiceClient()
    const [{ data: club }, { data: members }] = await Promise.all([
      db.from('clubs').select('name, advisor_id').eq('id', opts.clubId).maybeSingle(),
      db.from('memberships').select('user_id').eq('club_id', opts.clubId),
    ])
    if (!club) return

    const recipients = new Set<string>()
    for (const m of members ?? []) recipients.add(m.user_id as string)
    if (club.advisor_id) recipients.add(club.advisor_id as string)
    recipients.delete(opts.creatorId)
    if (recipients.size === 0) return

    await sendPushToUsers(Array.from(recipients), {
      title: `${club.name} · new event`,
      body: opts.title,
      path: `/clubs/${opts.clubId}`,
    })
  } catch (err) {
    console.warn('[notify] event push failed', err)
  }
}

/** Re-exported so a one-off reminder can target a single user if ever needed. */
export { sendPushToUser }
