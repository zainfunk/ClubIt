'use client'

// Moderation (route: /admin/moderation, phone + admin). Live via /api/admin/reports.

import { useEffect, useState } from 'react'
import { css, BOTTOM } from '../css'
import { ScreenHeader, Loader, EmptyState } from '../primitives'
import { useToast } from '../toast'
import { relTime } from '../format'

interface Report { id: string; reason: string | null; createdAt: string; reporterName: string; content: string; authorName: string; removed: boolean }

export default function Moderation() {
  const toast = useToast()
  const [reports, setReports] = useState<Report[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/reports', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled) setReports(((data?.reports ?? []) as Report[]).filter(r => !r.removed)) })
      .catch(() => { if (!cancelled) setReports([]) })
    return () => { cancelled = true }
  }, [])

  async function act(reportId: string, action: 'remove' | 'dismiss') {
    setReports(prev => prev ? prev.filter(r => r.id !== reportId) : prev)
    toast(action === 'remove' ? 'Message removed' : 'Report dismissed')
    try {
      await fetch('/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId, action }) })
    } catch { /* optimistic */ }
  }

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Moderation" subtitle="Reported chat messages awaiting review" />
      {reports === null ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {reports.length === 0 ? <EmptyState tone="good" title="All clear" sub="No open reports to review." /> : reports.map(r => (
            <div key={r.id} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:15px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:11px;')}>
                <span style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Reported by {r.reporterName} · {relTime(r.createdAt)}</span>
                {r.reason && <span style={css('font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:7px;background:#fef3c7;color:#b45309;flex:none;')}>{r.reason}</span>}
              </div>
              <div style={css('background:#f7f8fa;border:1px solid #eef0f3;border-radius:13px;padding:11px 13px;')}>
                <div style={css('font-size:11px;font-weight:700;color:#9aa0ac;margin-bottom:3px;')}>{r.authorName}</div>
                <div style={css('font-size:13.5px;color:#1f2734;font-weight:500;line-height:1.45;')}>{r.content}</div>
              </div>
              <div style={css('display:flex;gap:9px;margin-top:12px;')}>
                <button onClick={() => act(r.id, 'dismiss')} style={css('flex:1;height:38px;border-radius:11px;border:1px solid #e7e8ec;background:#fff;color:#475467;font-size:13px;font-weight:700;cursor:pointer;')}>Dismiss</button>
                <button onClick={() => act(r.id, 'remove')} style={css('flex:1;height:38px;border-radius:11px;border:none;background:#ef4444;color:#fff;font-size:13px;font-weight:700;cursor:pointer;')}>Remove message</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
