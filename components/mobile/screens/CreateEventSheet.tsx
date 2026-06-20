'use client'

// Bottom-sheet form to create a club event (advisor / event creator). Posts
// PATCH /api/school/clubs/[clubId] { action: 'create_event', ... }.

import { useState } from 'react'
import { css, BOTTOM } from '../css'
import { useToast } from '../toast'

export default function CreateEventSheet({ clubId, onClose, onCreated }: { clubId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [busy, setBusy] = useState(false)

  const valid = title.trim().length > 0 && !!date

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/school/clubs/${clubId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_event', title: title.trim(), date, location: location.trim() || undefined, isPublic }),
      })
      if (!res.ok) throw new Error()
      toast('Event created')
      onCreated()
      onClose()
    } catch {
      toast('Could not create event')
      setBusy(false)
    }
  }

  const field = 'width:100%;background:#f4f5f7;border:1px solid #e7e8ec;border-radius:12px;padding:11px 13px;font-size:14px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;box-sizing:border-box;'

  return (
    <div style={css('position:fixed;inset:0;z-index:130;')}>
      <div onClick={onClose} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
      <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 20px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(24) }}>
        <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 16px;')} />
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;letter-spacing:-.02em;color:#0f1729;margin-bottom:16px;")}>New event</div>

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:0 2px 6px;')}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spring Showcase" style={css(field)} />

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:14px 2px 6px;')}>Date</label>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={css(field)} />

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:14px 2px 6px;')}>Location (optional)</label>
        <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Auditorium" style={css(field)} />

        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:16px;')}>
          <div><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>Public event</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>Visible to the whole school</div></div>
          <button onClick={() => setIsPublic(v => !v)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;flex:none;background:${isPublic ? '#10b981' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${isPublic ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
        </div>

        <button disabled={!valid || busy} onClick={submit} style={css(`width:100%;height:48px;border-radius:14px;border:none;font-size:15px;font-weight:700;cursor:${valid && !busy ? 'pointer' : 'default'};margin-top:20px;background:${valid && !busy ? '#0f1729' : '#c5cad3'};color:#fff;`)}>{busy ? 'Creating…' : 'Create event'}</button>
      </div>
    </div>
  )
}
