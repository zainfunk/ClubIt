'use client'

// Shared mobile settings rows: "Report an issue" + "Delete account".
// Slotted into the Account card on both the student/advisor and admin settings
// screens. Report posts to /api/school/issues; delete posts to /api/user/delete
// (App Store Guideline 5.1.1(v) — in-app account deletion).

import { useState } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useMockAuth } from '@/lib/mock-auth'
import { css, BOTTOM } from './css'
import { useToast } from './toast'

function Row({ onClick, bg, stroke, icon, title, danger }: { onClick: () => void; bg: string; stroke: string; icon: React.ReactNode; title: string; danger?: boolean }) {
  return (
    <button onClick={onClick} style={css('width:100%;display:flex;align-items:center;gap:12px;padding:13px 0;border:none;border-top:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}>
      <span style={css(`width:34px;height:34px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;flex:none;`)}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
      </span>
      <span style={css(`flex:1;font-size:13.5px;font-weight:600;color:${danger ? '#ef4444' : '#1f2734'};`)}>{title}</span>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#c5cad3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  )
}

export default function AccountActions() {
  const toast = useToast()
  const { signOut } = useClerk()
  const { currentUser, schoolName, leaveSchool } = useMockAuth()
  const canLeave = !!currentUser.schoolId && currentUser.role !== 'superadmin'

  const [reportOpen, setReportOpen] = useState(false)
  const [issue, setIssue] = useState('')
  const [sending, setSending] = useState(false)

  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)

  const [delOpen, setDelOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [delError, setDelError] = useState<string | null>(null)

  async function leave() {
    setLeaving(true)
    setLeaveError(null)
    const result = await leaveSchool()
    if (!result.ok) {
      setLeaveError(result.message ?? 'Could not leave the school.')
      setLeaving(false)
      return
    }
    // success → provider redirects to /join
  }

  async function submitIssue() {
    if (!issue.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/school/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: issue.trim() }),
      })
      if (!res.ok) throw new Error()
      toast('Report sent — thank you')
      setIssue('')
      setReportOpen(false)
    } catch {
      toast('Could not send report')
    } finally {
      setSending(false)
    }
  }

  async function deleteAccount() {
    setDeleting(true)
    setDelError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.status === 'deleted') {
        await signOut({ redirectUrl: '/sign-in' })
        return
      }
      if (res.status === 409 && data.status === 'admin_requires_transfer') {
        setDelError(data.message ?? 'This account manages a school — deletion needs ownership transfer first. We’ve logged your request.')
        setDeleting(false)
        return
      }
      setDelError(data.error ?? 'Could not delete your account. Please try again.')
      setDeleting(false)
    } catch {
      setDelError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  const field = 'width:100%;background:#fff;border:1px solid #e7e8ec;border-radius:12px;padding:11px 13px;font-size:14px;color:#1f2734;font-weight:500;outline:none;font-family:inherit;box-sizing:border-box;'

  return (
    <>
      <Row onClick={() => setReportOpen(true)} bg="#fff7e6" stroke="#f59e0b" title="Report an issue"
        icon={<><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>} />
      {canLeave && (
        <Row onClick={() => { setLeaveOpen(true); setLeaveError(null) }} bg="#eef2ff" stroke="#6366f1" title="Leave school"
          icon={<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>} />
      )}
      <Row onClick={() => { setDelOpen(true); setConfirmText(''); setDelError(null) }} danger bg="#fff1f2" stroke="#ef4444" title="Delete account"
        icon={<><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></>} />

      {/* Report issue sheet */}
      {reportOpen && (
        <div style={css('position:fixed;inset:0;z-index:140;')}>
          <div onClick={() => setReportOpen(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.35);animation:fadeIn .2s ease;')} />
          <div style={{ ...css('position:absolute;left:0;right:0;bottom:0;background:#f2f2f7;border-radius:26px 26px 0 0;padding:10px 20px 0;animation:sheetUp .28s cubic-bezier(.32,.72,0,1);box-shadow:0 -8px 30px rgba(15,23,41,.18);'), paddingBottom: BOTTOM(24) }}>
            <div style={css('width:38px;height:5px;border-radius:3px;background:#d4d5db;margin:4px auto 16px;')} />
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:20px;letter-spacing:-.02em;color:#0f1729;margin-bottom:6px;")}>Report an issue</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-bottom:14px;')}>Tell us what went wrong — this goes to your school’s admins.</div>
            <textarea value={issue} onChange={e => setIssue(e.target.value)} rows={4} placeholder="Describe the problem…" style={css(field + 'resize:none;line-height:1.5;')} />
            <button disabled={!issue.trim() || sending} onClick={submitIssue} style={css(`width:100%;height:48px;border-radius:14px;border:none;font-size:15px;font-weight:700;cursor:${issue.trim() && !sending ? 'pointer' : 'default'};margin-top:16px;background:${issue.trim() && !sending ? '#0f1729' : '#c5cad3'};color:#fff;`)}>{sending ? 'Sending…' : 'Send report'}</button>
          </div>
        </div>
      )}

      {/* Leave school modal */}
      {leaveOpen && (
        <div style={css('position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;padding:24px;')}>
          <div onClick={() => !leaving && setLeaveOpen(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.4);animation:fadeIn .2s ease;')} />
          <div style={css('position:relative;width:100%;max-width:360px;background:#fff;border-radius:22px;padding:22px;animation:popIn .22s ease;box-shadow:0 20px 50px rgba(15,23,41,.3);')}>
            <div style={css('width:46px;height:46px;border-radius:14px;background:#eef2ff;display:flex;align-items:center;justify-content:center;margin-bottom:14px;')}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg></div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:18px;color:#0f1729;")}>Leave {schoolName ?? 'this school'}?</div>
            <div style={css('font-size:13px;color:#5b6270;font-weight:500;line-height:1.5;margin-top:6px;')}>You’ll be removed from your clubs here and returned to the join screen. You can rejoin later with an invite code.</div>
            {leaveError && <div style={css('font-size:12.5px;color:#e11d48;background:#fff1f2;border:1px solid #ffd9df;border-radius:10px;padding:9px 11px;margin-top:10px;line-height:1.4;')}>{leaveError}</div>}
            <div style={css('display:flex;gap:10px;margin-top:16px;')}>
              <button disabled={leaving} onClick={() => setLeaveOpen(false)} style={css('flex:1;height:46px;border-radius:13px;border:1px solid #e7e8ec;background:#fff;color:#1f2734;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;')}>Cancel</button>
              <button disabled={leaving} onClick={leave} style={css(`flex:1;height:46px;border-radius:13px;border:none;background:${leaving ? '#a5b4fc' : '#6366f1'};color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:${leaving ? 'default' : 'pointer'};`)}>{leaving ? 'Leaving…' : 'Leave'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account modal */}
      {delOpen && (
        <div style={css('position:fixed;inset:0;z-index:140;display:flex;align-items:center;justify-content:center;padding:24px;')}>
          <div onClick={() => !deleting && setDelOpen(false)} style={css('position:absolute;inset:0;background:rgba(15,23,41,.4);animation:fadeIn .2s ease;')} />
          <div style={css('position:relative;width:100%;max-width:360px;background:#fff;border-radius:22px;padding:22px;animation:popIn .22s ease;box-shadow:0 20px 50px rgba(15,23,41,.3);')}>
            <div style={css('width:46px;height:46px;border-radius:14px;background:#fff1f2;display:flex;align-items:center;justify-content:center;margin-bottom:14px;')}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg></div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:18px;color:#0f1729;")}>Delete your account?</div>
            <div style={css('font-size:13px;color:#5b6270;font-weight:500;line-height:1.5;margin-top:6px;')}>This permanently deletes your account, profile, memberships and attendance, and signs you out. It cannot be undone. Type <b>DELETE</b> to confirm.</div>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE" disabled={deleting} style={css(field + 'margin-top:14px;')} />
            {delError && <div style={css('font-size:12.5px;color:#e11d48;background:#fff1f2;border:1px solid #ffd9df;border-radius:10px;padding:9px 11px;margin-top:10px;line-height:1.4;')}>{delError}</div>}
            <div style={css('display:flex;gap:10px;margin-top:16px;')}>
              <button disabled={deleting} onClick={() => setDelOpen(false)} style={css('flex:1;height:46px;border-radius:13px;border:1px solid #e7e8ec;background:#fff;color:#1f2734;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;')}>Cancel</button>
              <button disabled={deleting || confirmText !== 'DELETE'} onClick={deleteAccount} style={css(`flex:1;height:46px;border-radius:13px;border:none;background:${confirmText === 'DELETE' && !deleting ? '#e11d48' : '#f3b6c0'};color:#fff;font-size:14px;font-weight:800;font-family:inherit;cursor:${confirmText === 'DELETE' && !deleting ? 'pointer' : 'default'};`)}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
