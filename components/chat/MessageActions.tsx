'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { MoreVertical, Flag, Ban, Loader2 } from 'lucide-react'

// Per-message moderation menu for chat (App Store Guideline 1.2): lets a user
// report an objectionable message or block its sender. Only rendered on other
// people's messages.
export default function MessageActions({
  messageId,
  senderId,
  senderName,
  onBlocked,
}: {
  messageId: string
  senderId: string
  senderName: string
  onBlocked: (userId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function report() {
    setBusy(true)
    try {
      const res = await fetch('/api/school/chat/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (res.ok) toast.success('Report submitted. Thanks — an admin will review it.')
      else toast.error('Could not submit the report. Please try again.')
    } catch {
      toast.error('Could not submit the report. Please try again.')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  async function block() {
    setBusy(true)
    try {
      const res = await fetch('/api/school/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: senderId }),
      })
      if (res.ok) {
        onBlocked(senderId)
        toast.success(`You blocked ${senderName}. You won't see their messages.`)
      } else {
        toast.error('Could not block this user. Please try again.')
      }
    } catch {
      toast.error('Could not block this user. Please try again.')
    } finally {
      setBusy(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative self-center" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Report or block"
        title="Report or block"
        // Always visible: on a touch device (e.g. the iPad used for App Review)
        // there is no hover, so a hover-only reveal would leave the report/block
        // controls unreachable — App Store Guideline 1.2 requires them to be
        // accessible. Muted by default, full-strength on hover for pointer users.
        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition opacity-70 hover:opacity-100"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-44 rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden py-1">
          <button
            onClick={report}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Flag className="w-3.5 h-3.5 text-amber-600" />
            Report message
          </button>
          <button
            onClick={block}
            disabled={busy}
            className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            Block {senderName.split(' ')[0]}
          </button>
        </div>
      )}
    </div>
  )
}
