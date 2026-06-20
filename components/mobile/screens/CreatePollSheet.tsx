'use client'

// Bottom-sheet to create a club election/poll (advisor / admin). Pick a position
// title and 2+ candidate members. PATCH { action: 'create_poll', ... }.

import { useState } from 'react'
import { css, BOTTOM, avBg, initials } from '../css'
import { clubAction } from '@/lib/school-api'
import { useToast } from '../toast'
import type { User } from '@/types'

export default function CreatePollSheet({ clubId, members, onClose, onCreated }: { clubId: string; members: User[]; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [candidateIds, setCandidateIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const valid = title.trim().length > 0 && candidateIds.length >= 2

  function toggle(id: string) {
    setCandidateIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    try {
      await clubAction(clubId, { action: 'create_poll', positionTitle: title.trim(), candidateIds })
      toast('Poll created')
      onCreated()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not create poll')
      setBusy(false)
    }
  }

  const field = 'width:100%;background:#fff;border:1px solid #e7e8ec;border-radius:12px;padding:11px 13px;font-size:14px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;box-sizing:border-box;'

  return (
    <div style={css('position:fixed;inset:0;z-index:130;')}>
      <div onClick={onClose} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
      <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 20px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);max-height:86vh;display:flex;flex-direction:column;'), paddingBottom: BOTTOM(24) }}>
        <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 16px;flex:none;')} />
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;letter-spacing:-.02em;color:#0f1729;margin-bottom:16px;flex:none;")}>New election</div>

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:0 2px 6px;flex:none;')}>Position</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="President" style={{ ...css(field), flex: 'none' }} />

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:14px 2px 6px;flex:none;')}>Candidates ({candidateIds.length} selected · pick 2+)</label>
        <div className="m-noscroll" style={css('flex:1;overflow-y:auto;background:#fff;border:1px solid #e7e8ec;border-radius:12px;padding:4px 14px;margin-bottom:4px;')}>
          {members.length === 0 ? (
            <div style={css('padding:18px 0;text-align:center;font-size:13px;color:#9aa0ac;')}>No members to nominate yet.</div>
          ) : members.map((m, i) => {
            const on = candidateIds.includes(m.id)
            return (
              <button key={m.id} onClick={() => toggle(m.id)} style={css(`width:100%;display:flex;align-items:center;gap:11px;padding:10px 0;border:none;background:none;cursor:pointer;text-align:left;${i < members.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                <span style={css(`width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;font-family:var(--font-manrope);flex:none;background:${avBg(m.name)};`)}>{initials(m.name)}</span>
                <span style={css('flex:1;font-size:13.5px;font-weight:600;color:#1f2734;')}>{m.name}</span>
                <span style={css(`width:22px;height:22px;border-radius:7px;border:2px solid ${on ? '#6366f1' : '#d4d5db'};background:${on ? '#6366f1' : '#fff'};display:flex;align-items:center;justify-content:center;flex:none;`)}>{on && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}</span>
              </button>
            )
          })}
        </div>

        <button disabled={!valid || busy} onClick={submit} style={css(`width:100%;height:48px;border-radius:14px;border:none;font-size:15px;font-weight:700;cursor:${valid && !busy ? 'pointer' : 'default'};margin-top:14px;background:${valid && !busy ? '#0f1729' : '#c5cad3'};color:#fff;flex:none;`)}>{busy ? 'Creating…' : 'Create election'}</button>
      </div>
    </div>
  )
}
