'use client'

// Create club (routes: /admin/new-club for admin, /clubs/new for advisor).
// POSTs to /api/school/clubs and returns to the clubs list.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { apiSchoolUsers } from '@/lib/school-api'
import type { User } from '@/types'
import { css, TOP, BOTTOM } from '../css'
import { useToast } from '../toast'

const ICONS = ['🎯', '🎸', '📚', '⚽', '🔬', '🎮', '🍳', '🧗', '🎤', '🌍', '🩺', '🎬']
const CATEGORIES = ['STEM', 'Arts', 'Academics', 'Community', 'Sports', 'Service']

export default function CreateClub() {
  const { actualUser, currentUser } = useMockAuth()
  const router = useRouter()
  const toast = useToast()

  const [icon, setIcon] = useState('🎯')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [advisorId, setAdvisorId] = useState('')
  const [tag, setTag] = useState('STEM')
  const [cap, setCap] = useState(20)
  const [unlimited, setUnlimited] = useState(false)
  const [advisors, setAdvisors] = useState<User[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!actualUser.id) return
    let cancelled = false
    apiSchoolUsers().then(users => {
      if (cancelled) return
      const elig = users.filter(u => u.role === 'advisor' || u.role === 'admin' || u.role === 'superadmin')
      setAdvisors(elig)
      setAdvisorId(elig.some(u => u.id === currentUser.id) ? currentUser.id : (elig[0]?.id ?? ''))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [actualUser.id, currentUser.id])

  const canCreate = name.trim().length > 0 && !busy

  async function create() {
    if (!canCreate) return
    setBusy(true)
    try {
      const res = await fetch('/api/school/clubs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          capacity: unlimited ? null : cap,
          advisorId,
          tags: [tag],
          eventCreatorIds: [],
          autoAccept: false,
          duesAmountCents: 0,
        }),
      })
      if (!res.ok) throw new Error()
      toast(`${name.trim()} created`)
      router.push('/clubs')
    } catch {
      toast('Could not create club')
      setBusy(false)
    }
  }

  const label = (t: string) => <div style={css('font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#98a2b3;margin:20px 4px 9px;')}>{t}</div>

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;background:#f2f2f7;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 18px 12px;display:flex;align-items:center;justify-content:space-between;flex:none;border-bottom:1px solid #e9e9ee;background:rgba(242,242,247,.88);backdrop-filter:blur(14px);'), paddingTop: TOP(14) }}>
        <button onClick={() => router.back()} style={css('border:none;background:none;font-size:15px;font-weight:600;color:#6366f1;cursor:pointer;padding:0;')}>Cancel</button>
        <span style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>New club</span>
        <button disabled={!canCreate} onClick={create} style={css(`border:none;background:none;font-size:15px;font-weight:700;cursor:${canCreate ? 'pointer' : 'default'};padding:0;color:${canCreate ? '#6366f1' : '#c0c4cd'};`)}>Create</button>
      </div>

      <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:18px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 40px)` }}>
        <div style={css('display:flex;flex-direction:column;align-items:center;margin-bottom:8px;')}>
          <span style={css('width:74px;height:74px;border-radius:22px;background:#fff;border:1px solid #eef0f3;display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 4px 14px rgba(16,24,40,.08);')}>{icon}</span>
        </div>

        {label('Choose an icon')}
        <div style={css('display:grid;grid-template-columns:repeat(6,1fr);gap:8px;')}>
          {ICONS.map(ic => (
            <button key={ic} onClick={() => setIcon(ic)} style={css(`aspect-ratio:1;border:none;border-radius:13px;font-size:21px;cursor:pointer;display:flex;align-items:center;justify-content:center;background:${icon === ic ? '#0f1729' : '#f4f5f7'};`)}>{ic}</button>
          ))}
        </div>

        {label('Club name')}
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Astronomy Club" style={css('width:100%;height:46px;border:1px solid #e7e8ec;border-radius:14px;background:#fff;padding:0 15px;font-size:15px;font-weight:600;color:#1f2734;font-family:inherit;outline:none;box-sizing:border-box;')} />

        {label('Description')}
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this club about? Who should join?" rows={3} style={css('width:100%;border:1px solid #e7e8ec;border-radius:14px;background:#fff;padding:12px 15px;font-size:14px;font-weight:500;color:#1f2734;font-family:inherit;outline:none;resize:none;line-height:1.5;box-sizing:border-box;')} />

        {label('Advisor')}
        <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
          {advisors.length === 0 ? <div style={css('font-size:12.5px;color:#9aa0ac;padding:4px;')}>No advisors yet — you’ll be set as advisor.</div> : advisors.map(a => {
            const on = advisorId === a.id
            return <button key={a.id} onClick={() => setAdvisorId(a.id)} style={css(`padding:9px 14px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;background:${on ? '#eef0ff' : '#fff'};color:${on ? '#6366f1' : '#5b6270'};border:1px solid ${on ? '#c7ccff' : '#e7e8ec'};`)}>{a.name}{a.id === currentUser.id ? ' (you)' : ''}</button>
          })}
        </div>

        {label('Category')}
        <div style={css('display:flex;flex-wrap:wrap;gap:8px;')}>
          {CATEGORIES.map(t => {
            const on = tag === t
            return <button key={t} onClick={() => setTag(t)} style={css(`padding:9px 14px;border-radius:12px;cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;background:${on ? '#0f1729' : '#fff'};color:${on ? '#fff' : '#5b6270'};border:1px solid ${on ? '#0f1729' : '#e7e8ec'};`)}>{t}</button>
          })}
        </div>

        {label('Capacity')}
        <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:14px 16px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
          <div style={css(`display:flex;align-items:center;justify-content:space-between;${unlimited ? 'opacity:.4;' : ''}`)}>
            <span style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>Member limit</span>
            <div style={css('display:flex;align-items:center;gap:14px;')}>
              <button disabled={unlimited} onClick={() => setCap(c => Math.max(1, c - 5))} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #e7e8ec;background:#fff;font-size:19px;font-weight:600;color:#475467;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;')}>−</button>
              <span style={css("font-family:var(--font-manrope);font-weight:800;font-size:19px;color:#0f1729;min-width:38px;text-align:center;")}>{unlimited ? '∞' : cap}</span>
              <button disabled={unlimited} onClick={() => setCap(c => Math.min(200, c + 5))} style={css('width:32px;height:32px;border-radius:10px;border:1px solid #e7e8ec;background:#fff;font-size:19px;font-weight:600;color:#475467;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;')}>+</button>
            </div>
          </div>
          <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:14px;padding-top:14px;border-top:1px solid #f4f5f7;')}>
            <div><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>No limit</div><div style={css('font-size:11px;color:#9aa0ac;')}>Anyone can join freely</div></div>
            <button onClick={() => setUnlimited(v => !v)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;background:${unlimited ? '#0f1729' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${unlimited ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
          </div>
        </div>

        <button disabled={!canCreate} onClick={create} style={css(`width:100%;height:50px;border-radius:15px;border:none;font-size:15px;font-weight:700;font-family:inherit;cursor:${canCreate ? 'pointer' : 'default'};margin-top:24px;background:${canCreate ? '#0f1729' : '#d7d8de'};color:${canCreate ? '#fff' : '#9aa0ac'};`)}>{busy ? 'Creating…' : 'Create club'}</button>
      </div>
    </div>
  )
}
