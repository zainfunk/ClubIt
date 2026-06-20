'use client'

// Club management (route: /clubs/[id]/manage, phone — advisor owner / admin).
// Mirrors the desktop club-detail management tools in the mobile design language.
// Every mutation reuses the existing PATCH /api/school/clubs/[id] actions via
// clubAction(); delete uses the DELETE handler via deleteClub().

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiClubDetail, clubAction, deleteClub, type ClubDetailPayload } from '@/lib/school-api'
import type { User } from '@/types'
import { css, TOP, BOTTOM } from '../css'
import { BackButton, Loader } from '../primitives'
import { dayShort, timeRange } from '../format'
import { useToast } from '../toast'

const ICONS = ['🎯', '🎸', '📚', '⚽', '🔬', '🎮', '🍳', '🧗', '🎤', '🌍', '🩺', '🎬', '🎨', '💻', '🏀', '♟️', '📷', '🎻']
const PLATFORMS = ['instagram', 'twitter', 'facebook', 'youtube', 'discord', 'website', 'other']
const DAY_OPTS = [0, 1, 2, 3, 4, 5, 6]

const field = 'width:100%;background:#fff;border:1px solid #e7e8ec;border-radius:12px;padding:11px 13px;font-size:14px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;box-sizing:border-box;'
const label = 'display:block;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#98a2b3;margin:0 2px 8px;'
const sectionTitle = "font-family:var(--font-manrope);font-weight:800;font-size:16px;letter-spacing:-.02em;color:#0f1729;margin:24px 4px 11px;"
const card = 'background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(16,24,40,.04);'

export default function ManageClub() {
  const params = useParams<{ id: string }>()
  const clubId = params?.id
  const { actualUser, currentUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()

  const [data, setData] = useState<ClubDetailPayload | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  // Club info form
  const [icon, setIcon] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [socials, setSocials] = useState<{ platform: string; url: string }[]>([])
  const [newPlatform, setNewPlatform] = useState('instagram')
  const [newUrl, setNewUrl] = useState('')

  // Capacity
  const [capUnlimited, setCapUnlimited] = useState(false)
  const [capValue, setCapValue] = useState(20)

  // Leadership
  const [newPosition, setNewPosition] = useState('')
  const [appoint, setAppoint] = useState<Record<string, string>>({})

  // Meeting time
  const [mtDay, setMtDay] = useState(1)
  const [mtStart, setMtStart] = useState('15:00')
  const [mtEnd, setMtEnd] = useState('16:00')
  const [mtLoc, setMtLoc] = useState('')

  // Dues
  const [duesInput, setDuesInput] = useState('')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  function hydrate(d: ClubDetailPayload) {
    setIcon(d.club.iconUrl && !d.club.iconUrl.startsWith('http') && !d.club.iconUrl.startsWith('data:') ? d.club.iconUrl : '')
    setDescription(d.club.description ?? '')
    setTags((d.club.tags ?? []).join(', '))
    setSocials(d.club.socialLinks.map(s => ({ platform: s.platform, url: s.url })))
    setCapUnlimited(d.club.capacity === null)
    setCapValue(d.club.capacity ?? 20)
    setDuesInput(((d.club.duesAmountCents ?? 0) / 100).toFixed(2))
  }

  useEffect(() => {
    if (!actualUser.id || !clubId) return
    let cancelled = false
    apiClubDetail(clubId).then(d => {
      if (cancelled) return
      setData(d)
      if (d) hydrate(d)
      setLoaded(true)
    }).catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [actualUser.id, clubId])

  async function reload() {
    if (!clubId) return
    const d = await apiClubDetail(clubId)
    if (d) setData(d)
  }

  // Run an action, reload, toast. Returns true on success.
  async function act(body: Record<string, unknown>, okMsg?: string): Promise<boolean> {
    if (!clubId || busy) return false
    setBusy(true)
    try {
      await clubAction(clubId, body)
      await reload()
      if (okMsg) toast(okMsg)
      return true
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong')
      return false
    } finally {
      setBusy(false)
    }
  }

  const members: User[] = useMemo(
    () => (data?.club.memberIds ?? []).map(id => data?.usersById[id]).filter(Boolean) as User[],
    [data]
  )

  if (!loaded) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(14), paddingLeft: 16 }}><BackButton onClick={() => router.push(`/clubs/${clubId}`)} /></div>
        <Loader />
      </div>
    )
  }

  if (!data) {
    return (
      <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;')}>
        <div style={{ paddingTop: TOP(14), paddingLeft: 16 }}><BackButton onClick={() => router.push('/clubs')} /></div>
        <div style={css('flex:1;display:flex;align-items:center;justify-content:center;font-size:14px;color:#9aa0ac;')}>Club not found.</div>
      </div>
    )
  }

  const { club } = data
  const isManager = currentUser.role === 'admin' || currentUser.role === 'superadmin' || club.advisorId === currentUser.id
  if (!isManager) {
    // Non-managers shouldn't be here; bounce to the read-only detail.
    router.replace(`/clubs/${clubId}`)
    return null
  }

  async function saveInfo() {
    const ok = await act({
      action: 'save_edit',
      iconUrl: icon || club.iconUrl,
      description: description.trim() || club.description,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : club.tags,
      socialLinks: socials.filter(s => s.url.trim()),
    }, 'Club updated')
    return ok
  }

  async function saveCapacity(unlimited: boolean, value: number) {
    const newCap = unlimited ? null : Math.max(club.memberIds.length, value)
    await act({ action: 'save_capacity', capacity: newCap }, 'Limit updated')
  }

  async function addMeeting() {
    if (!mtStart || !mtEnd) return
    const ok = await act({ action: 'add_meeting_time', dayOfWeek: mtDay, startTime: mtStart, endTime: mtEnd, location: mtLoc.trim() || undefined }, 'Meeting time added')
    if (ok) setMtLoc('')
  }

  async function saveDues() {
    const dollars = parseFloat(duesInput)
    if (Number.isNaN(dollars) || dollars < 0) { toast('Enter a valid amount'); return }
    await act({ action: 'set_dues_amount', amountCents: Math.round(dollars * 100) }, 'Dues amount saved')
  }

  async function doDelete() {
    if (!clubId) return
    setBusy(true)
    try {
      await deleteClub(clubId)
      toast('Club deleted')
      router.replace('/clubs')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete club')
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const roleByUser: Record<string, string> = {}
  for (const p of club.leadershipPositions) if (p.userId) roleByUser[p.userId] = p.title

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 16px 12px;display:flex;align-items:center;gap:12px;flex:none;background:rgba(242,242,247,.9);backdrop-filter:blur(14px);border-bottom:1px solid #e9e9ee;'), paddingTop: TOP(14) }}>
        <BackButton onClick={() => router.push(`/clubs/${clubId}`)} />
        <div style={css('min-width:0;')}>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:18px;letter-spacing:-.02em;color:#0f1729;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;")}>Manage club</div>
          <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{club.name}</div>
        </div>
      </div>

      <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:4px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 60px)` }}>

        {/* ── Club info ── */}
        <div style={css(sectionTitle)}>Club info</div>
        <div style={css(card)}>
          <label style={css(label)}>Icon</label>
          <div style={css('display:grid;grid-template-columns:repeat(6,1fr);gap:8px;')}>
            {ICONS.map(ic => (
              <button key={ic} onClick={() => setIcon(ic)} style={css(`aspect-ratio:1;border:none;border-radius:12px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:${icon === ic ? '#0f1729' : '#f4f5f7'};`)}>{ic}</button>
            ))}
          </div>
          <label style={css(label + 'margin-top:16px;')}>Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} style={css(field + 'resize:none;line-height:1.5;')} />
          <label style={css(label + 'margin-top:14px;')}>Tags (comma separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="STEM, Arts" style={css(field)} />

          <label style={css(label + 'margin-top:16px;')}>Social links</label>
          {socials.map((s, i) => (
            <div key={i} style={css('display:flex;align-items:center;gap:8px;margin-bottom:8px;')}>
              <span style={css('flex:1;min-width:0;font-size:12.5px;color:#5b6270;font-weight:600;background:#f4f5f7;border-radius:10px;padding:9px 11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{s.platform} · {s.url}</span>
              <button onClick={() => setSocials(prev => prev.filter((_, idx) => idx !== i))} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #eceef1;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#98a2b3" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>
          ))}
          <div style={css('display:flex;align-items:center;gap:8px;')}>
            <select value={newPlatform} onChange={e => setNewPlatform(e.target.value)} style={css('background:#f4f5f7;border:1px solid #e7e8ec;border-radius:10px;padding:9px;font-size:12.5px;color:#1f2734;font-family:inherit;flex:none;')}>
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://…" style={css(field)} />
            <button onClick={() => { if (newUrl.trim()) { setSocials(prev => [...prev, { platform: newPlatform, url: newUrl.trim() }]); setNewUrl('') } }} style={css('width:38px;height:38px;border-radius:11px;border:none;background:#eef0ff;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
          </div>

          <button disabled={busy} onClick={saveInfo} style={css('width:100%;height:46px;border-radius:13px;border:none;background:#0f1729;color:#fff;font-size:14.5px;font-weight:700;font-family:inherit;cursor:pointer;margin-top:18px;')}>Save changes</button>
        </div>

        {/* ── Access ── */}
        <div style={css(sectionTitle)}>Access</div>
        <div style={css(card)}>
          <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
            <div><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>Auto-accept members</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>Approve join requests instantly</div></div>
            <button onClick={() => act({ action: 'toggle_auto_accept' })} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;flex:none;background:${club.autoAccept ? '#10b981' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${club.autoAccept ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
          </div>
          <div style={css('border-top:1px solid #f4f5f7;margin:14px 0;')} />
          <div style={css(`display:flex;align-items:center;justify-content:space-between;${capUnlimited ? 'opacity:.45;' : ''}`)}>
            <span style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>Member limit</span>
            <div style={css('display:flex;align-items:center;gap:14px;')}>
              <button disabled={capUnlimited} onClick={() => setCapValue(c => Math.max(club.memberIds.length || 1, c - 5))} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #e7e8ec;background:#fff;font-size:19px;color:#475467;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>−</button>
              <span style={css("font-family:var(--font-manrope);font-weight:800;font-size:19px;color:#0f1729;min-width:38px;text-align:center;")}>{capUnlimited ? '∞' : capValue}</span>
              <button disabled={capUnlimited} onClick={() => setCapValue(c => Math.min(500, c + 5))} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #e7e8ec;background:#fff;font-size:19px;color:#475467;cursor:pointer;display:flex;align-items:center;justify-content:center;')}>+</button>
            </div>
          </div>
          <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:14px;')}>
            <div><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>No limit</div><div style={css('font-size:11px;color:#9aa0ac;')}>Anyone can join</div></div>
            <button onClick={() => setCapUnlimited(v => !v)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;flex:none;background:${capUnlimited ? '#0f1729' : '#d4d5db'};`)}><span style={css(`position:absolute;top:3px;left:${capUnlimited ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);`)} /></button>
          </div>
          <button disabled={busy} onClick={() => saveCapacity(capUnlimited, capValue)} style={css('width:100%;height:42px;border-radius:12px;border:1px solid #e7e8ec;background:#fff;color:#0f1729;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;margin-top:16px;')}>Save limit</button>
        </div>

        {/* ── Leadership ── */}
        <div style={css(sectionTitle)}>Leadership</div>
        <div style={css(card)}>
          {club.leadershipPositions.length === 0 && <div style={css('font-size:12.5px;color:#9aa0ac;padding:2px 0 12px;')}>No positions yet.</div>}
          {club.leadershipPositions.map((p, i) => {
            const holder = p.userId ? data.usersById[p.userId] : null
            return (
              <div key={p.id} style={css(`padding:12px 0;${i < club.leadershipPositions.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;')}>
                  <span style={css('font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#98a2b3;')}>{p.title}</span>
                  <button onClick={() => act({ action: 'remove_leadership_position', positionId: p.id }, 'Position removed')} style={css('font-size:11.5px;font-weight:700;color:#e11d48;background:none;border:none;cursor:pointer;')}>Remove</button>
                </div>
                {holder ? (
                  <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:7px;')}>
                    <span style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{holder.name}</span>
                    <button onClick={() => act({ action: 'vacate_leader', positionId: p.id }, 'Position vacated')} style={css('font-size:11.5px;font-weight:700;color:#64748b;background:#f1f2f4;border:none;padding:5px 10px;border-radius:8px;cursor:pointer;')}>Vacate</button>
                  </div>
                ) : (
                  <div style={css('display:flex;align-items:center;gap:8px;margin-top:8px;')}>
                    <select value={appoint[p.id] ?? ''} onChange={e => setAppoint(prev => ({ ...prev, [p.id]: e.target.value }))} style={css('flex:1;min-width:0;background:#f4f5f7;border:1px solid #e7e8ec;border-radius:10px;padding:9px;font-size:13px;color:#1f2734;font-family:inherit;')}>
                      <option value="">Select member…</option>
                      {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <button disabled={!appoint[p.id]} onClick={() => { const uid = appoint[p.id]; if (uid) act({ action: 'appoint_leader', positionId: p.id, appointUserId: uid }, 'Member appointed') }} style={css(`height:38px;padding:0 14px;border-radius:10px;border:none;background:${appoint[p.id] ? '#0f1729' : '#d7d8de'};color:#fff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;flex:none;`)}>Set</button>
                  </div>
                )}
              </div>
            )
          })}
          <div style={css('display:flex;align-items:center;gap:8px;margin-top:12px;')}>
            <input value={newPosition} onChange={e => setNewPosition(e.target.value)} placeholder="New position (e.g. President)" style={css(field)} />
            <button disabled={!newPosition.trim()} onClick={() => { const t = newPosition.trim(); if (t) act({ action: 'add_leadership_position', title: t }, 'Position added').then(ok => { if (ok) setNewPosition('') }) }} style={css(`width:38px;height:38px;border-radius:11px;border:none;background:${newPosition.trim() ? '#eef0ff' : '#f4f5f7'};display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none;`)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={newPosition.trim() ? '#6366f1' : '#c0c4cd'} strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></button>
          </div>
        </div>

        {/* ── Meeting times ── */}
        <div style={css(sectionTitle)}>Meeting times</div>
        <div style={css(card)}>
          {club.meetingTimes.length === 0 && <div style={css('font-size:12.5px;color:#9aa0ac;padding:2px 0 12px;')}>No meeting times set.</div>}
          {club.meetingTimes.map((m, i) => (
            <div key={m.id} style={css(`display:flex;align-items:center;justify-content:space-between;padding:11px 0;${i < club.meetingTimes.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
              <div><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{dayShort(m.dayOfWeek)}</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>{timeRange(m.startTime, m.endTime)}{m.location ? ` · ${m.location}` : ''}</div></div>
              <button onClick={() => act({ action: 'remove_meeting_time', meetingTimeId: m.id }, 'Meeting time removed')} style={css('font-size:11.5px;font-weight:700;color:#e11d48;background:none;border:none;cursor:pointer;')}>Remove</button>
            </div>
          ))}
          <div style={css('margin-top:14px;')}>
            <div style={css('display:flex;gap:8px;')}>
              <select value={mtDay} onChange={e => setMtDay(Number(e.target.value))} style={css('flex:1;background:#fff;border:1px solid #e7e8ec;border-radius:10px;padding:9px;font-size:13px;color:#1f2734;font-family:inherit;')}>
                {DAY_OPTS.map(d => <option key={d} value={d}>{dayShort(d)}</option>)}
              </select>
              <input type="time" value={mtStart} onChange={e => setMtStart(e.target.value)} style={css('flex:1;background:#fff;border:1px solid #e7e8ec;border-radius:10px;padding:9px;font-size:13px;color:#1f2734;font-family:inherit;')} />
              <input type="time" value={mtEnd} onChange={e => setMtEnd(e.target.value)} style={css('flex:1;background:#fff;border:1px solid #e7e8ec;border-radius:10px;padding:9px;font-size:13px;color:#1f2734;font-family:inherit;')} />
            </div>
            <div style={css('display:flex;gap:8px;margin-top:8px;')}>
              <input value={mtLoc} onChange={e => setMtLoc(e.target.value)} placeholder="Location (optional)" style={css(field)} />
              <button disabled={busy} onClick={addMeeting} style={css('height:38px;padding:0 16px;border-radius:11px;border:none;background:#0f1729;color:#fff;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;flex:none;')}>Add</button>
            </div>
          </div>
        </div>

        {/* ── Dues ── */}
        <div style={css(sectionTitle)}>Dues</div>
        <div style={css(card)}>
          <label style={css(label)}>Amount per member (USD)</label>
          <div style={css('display:flex;gap:8px;')}>
            <input value={duesInput} onChange={e => setDuesInput(e.target.value)} inputMode="decimal" placeholder="0.00" style={css(field)} />
            <button disabled={busy} onClick={saveDues} style={css('height:42px;padding:0 18px;border-radius:12px;border:none;background:#0f1729;color:#fff;font-size:13.5px;font-weight:700;font-family:inherit;cursor:pointer;flex:none;')}>Save</button>
          </div>
          {(club.duesAmountCents ?? 0) > 0 && members.length > 0 && (
            <div style={css('margin-top:16px;')}>
              <label style={css(label)}>Mark paid</label>
              {members.map((m, i) => {
                const paid = data.duesPayments.some(p => p.userId === m.id && p.paid)
                return (
                  <div key={m.id} style={css(`display:flex;align-items:center;justify-content:space-between;padding:10px 0;${i < members.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}</span>
                    <button onClick={() => act({ action: paid ? 'mark_dues_unpaid' : 'mark_dues_paid', memberId: m.id }, paid ? 'Marked unpaid' : 'Marked paid')} style={css(`font-size:11.5px;font-weight:800;padding:5px 11px;border-radius:8px;border:none;cursor:pointer;background:${paid ? '#e8faf2' : '#f1f2f4'};color:${paid ? '#10b981' : '#64748b'};`)}>{paid ? 'Paid ✓' : 'Mark paid'}</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Event permissions ── */}
        {members.length > 0 && (
          <>
            <div style={css(sectionTitle)}>Event creators</div>
            <div style={css(card)}>
              <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-bottom:10px;')}>Members who can post events &amp; news for this club.</div>
              {members.map((m, i) => {
                const can = club.eventCreatorIds.includes(m.id)
                return (
                  <div key={m.id} style={css(`display:flex;align-items:center;justify-content:space-between;padding:10px 0;${i < members.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}{roleByUser[m.id] ? ` · ${roleByUser[m.id]}` : ''}</span>
                    <button onClick={() => act({ action: 'set_event_creators', eventCreatorIds: can ? club.eventCreatorIds.filter(x => x !== m.id) : [...club.eventCreatorIds, m.id] })} style={css(`font-size:11.5px;font-weight:800;padding:5px 11px;border-radius:8px;border:none;cursor:pointer;background:${can ? '#f3edff' : '#f1f2f4'};color:${can ? '#8b5cf6' : '#64748b'};`)}>{can ? 'Creator ✓' : 'Grant'}</button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Danger zone ── */}
        <div style={css(sectionTitle + 'color:#e11d48;')}>Danger zone</div>
        <div style={css('background:#fff;border:1px solid #ffd9df;border-radius:18px;padding:16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
          {!confirmDelete ? (
            <>
              <div style={css('font-size:13.5px;font-weight:700;color:#0f1729;')}>Delete this club</div>
              <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>Permanently removes the club, its members, events, news, polls and dues. This cannot be undone.</div>
              <button onClick={() => setConfirmDelete(true)} style={css('width:100%;height:46px;border-radius:13px;border:none;background:#ffe4e6;color:#e11d48;font-size:14.5px;font-weight:800;font-family:inherit;cursor:pointer;margin-top:14px;')}>Delete club</button>
            </>
          ) : (
            <>
              <div style={css('font-size:13.5px;font-weight:700;color:#e11d48;')}>Delete “{club.name}”?</div>
              <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>This is permanent and removes everything tied to the club.</div>
              <div style={css('display:flex;gap:10px;margin-top:14px;')}>
                <button disabled={busy} onClick={() => setConfirmDelete(false)} style={css('flex:1;height:46px;border-radius:13px;border:1px solid #e7e8ec;background:#fff;color:#1f2734;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;')}>Cancel</button>
                <button disabled={busy} onClick={doDelete} style={css('flex:1;height:46px;border-radius:13px;border:none;background:#e11d48;color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:pointer;')}>{busy ? 'Deleting…' : 'Delete forever'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
