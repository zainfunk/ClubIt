'use client'

// Bottom-sheet to post a club news update (advisor / event-creator).
// PATCH /api/school/clubs/[clubId] { action: 'post_news', ... }.

import { useState } from 'react'
import { css, BOTTOM } from '../css'
import { clubAction } from '@/lib/school-api'
import { useToast } from '../toast'

export default function CreateNewsSheet({ clubId, onClose, onCreated }: { clubId: string; onClose: () => void; onCreated: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [pinned, setPinned] = useState(false)
  const [busy, setBusy] = useState(false)

  const valid = title.trim().length > 0 && content.trim().length > 0

  async function submit() {
    if (!valid || busy) return
    setBusy(true)
    try {
      await clubAction(clubId, { action: 'post_news', title: title.trim(), content: content.trim(), isPinned: pinned })
      toast('News posted')
      onCreated()
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not post news')
      setBusy(false)
    }
  }

  const field = 'width:100%;background:#fff;border:1px solid #e7e8ec;border-radius:12px;padding:11px 13px;font-size:14px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;box-sizing:border-box;'

  return (
    <div style={css('position:fixed;inset:0;z-index:130;')}>
      <div onClick={onClose} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
      <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 20px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(24) }}>
        <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 16px;')} />
        <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;letter-spacing:-.02em;color:#0f1729;margin-bottom:16px;")}>Post news</div>

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:0 2px 6px;')}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Tryouts next week" style={css(field)} />

        <label style={css('display:block;font-size:11.5px;font-weight:700;color:#8a8f9a;margin:14px 2px 6px;')}>Update</label>
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} placeholder="Share an update with the club…" style={css(field + 'resize:none;line-height:1.5;')} />

        <div style={css('display:flex;align-items:center;justify-content:space-between;margin-top:16px;')}>
          <div><div style={css('font-size:13.5px;font-weight:600;color:#1f2734;')}>Pin to top</div><div style={css('font-size:11.5px;color:#9aa0ac;')}>Keep this above other posts</div></div>
          <button onClick={() => setPinned(v => !v)} style={css(`width:46px;height:28px;border-radius:15px;border:none;cursor:pointer;position:relative;flex:none;background:${pinned ? '#6366f1' : '#d4d5db'};transition:background .2s;`)}><span style={css(`position:absolute;top:3px;left:${pinned ? '21px' : '3px'};width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:left .2s;`)} /></button>
        </div>

        <button disabled={!valid || busy} onClick={submit} style={css(`width:100%;height:48px;border-radius:14px;border:none;font-size:15px;font-weight:700;cursor:${valid && !busy ? 'pointer' : 'default'};margin-top:20px;background:${valid && !busy ? '#0f1729' : '#c5cad3'};color:#fff;`)}>{busy ? 'Posting…' : 'Post news'}</button>
      </div>
    </div>
  )
}
