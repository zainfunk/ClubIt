'use client'

// Invite codes + staff-access approvals (route: /invites, phone + admin).
// Live via /api/school/invites and /api/school/staff-requests.

import { useEffect, useState } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import { css, BOTTOM } from '../css'
import { ScreenHeader, Loader } from '../primitives'
import { useToast } from '../toast'

interface InviteData { schoolName: string; studentCode: string | null; advisorCode: string | null; adminCode: string | null }
interface StaffRequest { id: string; userId: string; requestedRole: 'admin' | 'advisor'; createdAt: string; name: string; email: string }

export default function AdminInvites() {
  const { schoolName } = useMockAuth()
  const toast = useToast()
  const [data, setData] = useState<InviteData | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [requests, setRequests] = useState<StaffRequest[] | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/school/invites', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) { setData(d); setLoaded(true) } })
      .catch(() => { if (!cancelled) setLoaded(true) })
    fetch('/api/school/staff-requests', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setRequests(d?.requests ?? []) })
      .catch(() => { if (!cancelled) setRequests([]) })
    return () => { cancelled = true }
  }, [])

  function copy(key: string, label: string, code: string | null) {
    if (!code) return
    try { navigator.clipboard.writeText(code) } catch { /* unavailable */ }
    setCopied(key)
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1500)
    toast(`${label} code copied`)
  }

  async function decide(id: string, decision: 'approve' | 'deny') {
    setActing(id)
    try {
      const res = await fetch('/api/school/staff-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, decision }),
      })
      if (!res.ok) throw new Error()
      setRequests(prev => (prev ? prev.filter(r => r.id !== id) : prev))
      toast(decision === 'approve' ? 'Access granted' : 'Request denied')
    } catch {
      toast('Could not update the request')
    } finally {
      setActing(null)
    }
  }

  const rows = [
    { key: 'student', label: 'Students', accent: '#10b981', code: data?.studentCode ?? null },
    { key: 'advisor', label: 'Advisors', accent: '#6366f1', code: data?.advisorCode ?? null },
    { key: 'admin', label: 'Admins', accent: '#e11d48', code: data?.adminCode ?? null },
  ]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <ScreenHeader title="Invite codes" subtitle={`Share these so new members can join ${schoolName || 'your school'}.`} />
      {!loaded ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>

          {requests && requests.length > 0 && (
            <div style={css('background:#fff;border:1px solid #fde2e7;border-radius:18px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <div style={css('display:flex;align-items:center;gap:8px;margin-bottom:4px;')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V5z" /><path d="M9 12l2 2 4-4" /></svg>
                <span style={css('font-size:13px;font-weight:800;color:#0f1729;')}>Staff access requests</span>
                <span style={css('font-size:11px;font-weight:800;color:#e11d48;background:#fff1f3;border-radius:999px;padding:2px 8px;')}>{requests.length}</span>
              </div>
              <div style={css('font-size:12px;color:#8a8f9a;font-weight:500;line-height:1.5;margin-bottom:12px;')}>These people used the admin or advisor code. Approve only those you trust — approval is what actually grants the role.</div>
              {requests.map(r => (
                <div key={r.id} style={css('border:1px solid #eef0f3;border-radius:14px;padding:12px;margin-bottom:10px;')}>
                  <div style={css('display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px;')}>
                    <span style={css('font-size:14px;font-weight:700;color:#1f2734;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{r.name}</span>
                    <span style={css(`font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 8px;border-radius:8px;flex:none;background:${r.requestedRole === 'admin' ? '#fff1f3' : '#eef0ff'};color:${r.requestedRole === 'admin' ? '#e11d48' : '#6366f1'};`)}>{r.requestedRole}</span>
                  </div>
                  {r.email && <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-bottom:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{r.email}</div>}
                  <div style={css('display:flex;gap:8px;')}>
                    <button disabled={acting === r.id} onClick={() => decide(r.id, 'approve')} style={css(`flex:1;height:38px;border-radius:11px;border:none;background:${acting === r.id ? '#a7f3d0' : '#10b981'};color:#fff;font-size:13px;font-weight:700;cursor:pointer;`)}>Approve</button>
                    <button disabled={acting === r.id} onClick={() => decide(r.id, 'deny')} style={css('flex:1;height:38px;border-radius:11px;border:1px solid #e7e8ec;background:#fff;color:#64748b;font-size:13px;font-weight:700;cursor:pointer;')}>Deny</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rows.map(iv => {
            const isCopied = copied === iv.key
            return (
              <div key={iv.key} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:16px;margin-bottom:12px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;')}><span style={css(`font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${iv.accent};`)}>{iv.label}</span></div>
                <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
                  <code style={css('font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:.06em;color:#0f1729;overflow:hidden;text-overflow:ellipsis;')}>{iv.code ?? '—'}</code>
                  <button disabled={!iv.code} onClick={() => copy(iv.key, iv.label, iv.code)} style={css(`height:36px;padding:0 14px;border-radius:11px;border:1px solid #e7e8ec;background:${isCopied ? '#e8faf2' : '#fff'};color:${isCopied ? '#10b981' : iv.code ? '#475467' : '#c5cad3'};font-size:12.5px;font-weight:700;cursor:${iv.code ? 'pointer' : 'default'};display:flex;align-items:center;gap:6px;flex:none;`)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>{isCopied ? 'Copied' : 'Copy'}</button>
                </div>
              </div>
            )
          })}
          <div style={css('background:#eef0ff;border:1px solid #e0e3ff;border-radius:16px;padding:14px 16px;display:flex;gap:11px;margin-top:4px;')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={css('flex:none;margin-top:1px;')}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
            <div style={css('font-size:12.5px;color:#4c4f8a;font-weight:500;line-height:1.5;')}>The student code lets anyone join as a student. The admin &amp; advisor codes only file a request — no one becomes staff until you approve them above, so a leaked code can&apos;t create an admin.</div>
          </div>
        </div>
      )}
    </div>
  )
}
