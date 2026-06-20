'use client'

import { useIsAdminPhone } from '@/components/mobile/useIsAdminPhone'
import Moderation from '@/components/mobile/screens/Moderation'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import RoleGuard from '@/components/layout/RoleGuard'
import { Flag, Loader2, Trash2, Check, ShieldCheck } from 'lucide-react'

interface Report {
  id: string
  reason: string | null
  createdAt: string
  reporterName: string
  messageId: string
  content: string
  authorName: string
  removed: boolean
}

export default function ModerationPage() {
  const adminPhone = useIsAdminPhone()
  if (adminPhone) return <Moderation />
  return <ModerationDesktop />
}

function ModerationDesktop() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/reports', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { reports?: Report[] }) => setReports(data.reports ?? []))
      .catch(() => toast.error('Could not load reports'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  async function act(reportId: string, action: 'remove' | 'dismiss') {
    setActing(reportId)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, action }),
      })
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId))
        toast.success(action === 'remove' ? 'Message removed' : 'Report dismissed')
      } else {
        toast.error('Action failed. Please try again.')
      }
    } catch {
      toast.error('Action failed. Please try again.')
    } finally {
      setActing(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  const content = (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: 'var(--font-inter)' }}>
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2" style={{ fontFamily: 'var(--font-manrope)' }}>
          <Flag className="w-5 h-5 text-amber-600" />
          Moderation
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Reported chat messages. Review and remove anything that violates the
          community guidelines, or dismiss false reports.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No open reports</p>
          <p className="text-xs text-slate-400 mt-1">Reported messages will show up here for review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-xs text-slate-500">
                  Reported by <span className="font-semibold text-slate-700">{r.reporterName}</span> · {formatDate(r.createdAt)}
                </div>
                {r.reason && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                    {r.reason}
                  </span>
                )}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
                <p className="text-[11px] font-semibold text-slate-400 mb-1">{r.authorName}</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">
                  {r.removed ? <span className="italic text-slate-400">{r.content}</span> : r.content}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 mt-3">
                <button
                  onClick={() => act(r.id, 'dismiss')}
                  disabled={acting === r.id}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 transition disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Dismiss
                </button>
                <button
                  onClick={() => act(r.id, 'remove')}
                  disabled={acting === r.id || r.removed}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 transition disabled:opacity-40"
                >
                  {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Remove message
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return <RoleGuard allowed={['admin']}>{content}</RoleGuard>
}
