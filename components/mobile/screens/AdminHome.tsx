'use client'

// Admin home (route: /dashboard, phone + admin). Live data from /api/school/clubs,
// /api/school/elections, /api/admin/reports and the users / issue_reports tables.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMockAuth } from '@/lib/mock-auth'
import { supabase } from '@/lib/supabase'
import type { Club } from '@/types'
import { css, TOP, BOTTOM, avBg, initials } from '../css'
import { Loader } from '../primitives'
import { useToast } from '../toast'

interface ReportRow { id: string; removed: boolean }
interface IssueRow { id: string; message: string; reporter_name: string; status: string; created_at: string }

export default function AdminHome() {
  const { actualUser, currentUser, schoolName } = useMockAuth()
  const router = useRouter()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [studentCount, setStudentCount] = useState(0)
  const [openElections, setOpenElections] = useState(0)
  const [reports, setReports] = useState<ReportRow[]>([])
  const [issues, setIssues] = useState<IssueRow[]>([])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,'
  }, [])

  useEffect(() => {
    const schoolId = actualUser.schoolId
    if (!schoolId) return
    let cancelled = false

    async function load() {
      const [clubsRes, electionsRes, reportsRes, usersRes, issuesRes] = await Promise.all([
        fetch('/api/school/clubs', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/school/elections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/admin/reports', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
        supabase.from('issue_reports').select('id, message, reporter_name, status, created_at').eq('school_id', schoolId).eq('status', 'open').order('created_at', { ascending: false }),
      ])
      if (cancelled) return
      setClubs(clubsRes?.clubs ?? [])
      setOpenElections((electionsRes?.elections ?? []).filter((e: { isOpen: boolean }) => e.isOpen).length)
      setReports((reportsRes?.reports ?? []).filter((r: ReportRow) => !r.removed))
      setStudentCount(usersRes.count ?? 0)
      setIssues((issuesRes.data as IssueRow[]) ?? [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [actualUser.schoolId])

  async function resolveIssue(id: string) {
    setIssues(prev => prev.filter(i => i.id !== id))
    await supabase.from('issue_reports').update({ status: 'resolved' }).eq('id', id)
    toast('Issue marked resolved')
  }

  const attentionCount = reports.length + issues.length

  const stats = [
    { bg: '#eef0ff', stroke: '#6366f1', icon: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />, num: clubs.length, label: 'Active clubs' },
    { bg: '#e8faf2', stroke: '#10b981', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>, num: studentCount, label: 'Students' },
    { bg: '#fff1e9', stroke: '#f59e0b', icon: <><path d="M12 6v6l4 2" /><circle cx="12" cy="12" r="9" /></>, num: reports.length, label: 'Open reports' },
    { bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />, num: openElections, label: 'Open elections' },
  ]

  const quickActions = [
    { bg: '#eef0ff', stroke: '#6366f1', icon: <path d="M12 5v14M5 12h14" />, label: 'New club', onClick: () => router.push('/admin') },
    { bg: '#f3edff', stroke: '#8b5cf6', icon: <path d="M9 12l2 2 4-4M5 7l7-4 7 4v6c0 5-3.5 7.5-7 8.5C8.5 20.5 5 18 5 13z" />, label: 'Start election', onClick: () => router.push('/admin') },
    { bg: '#e8faf2', stroke: '#10b981', icon: <path d="M21 2 11 12M21 2l-7 20-4-9-9-4z" />, label: 'Invite codes', onClick: () => router.push('/invites') },
    { bg: '#fff1e9', stroke: '#f59e0b', icon: <><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></>, label: 'New event', onClick: () => router.push('/events') },
  ]

  return (
    <div style={css('position:absolute;inset:0;display:flex;flex-direction:column;animation:scIn .24s ease;')}>
      <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;flex:none;'), paddingTop: TOP(20) }}>
        <div style={css('display:flex;align-items:center;justify-content:space-between;')}>
          <div style={css('min-width:0;')}>
            <div style={css('font-size:13px;color:#8a8f9a;font-weight:600;')}>{greeting}</div>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:25px;letter-spacing:-.03em;color:#0f1729;line-height:1.1;margin-top:1px;")}>{currentUser.name || 'Admin'}</div>
            <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{schoolName || 'Your school'}</div>
          </div>
          <div style={css('display:flex;align-items:center;gap:10px;flex:none;')}>
            <button onClick={() => toast(attentionCount ? `${attentionCount} items need attention` : 'You’re all caught up')} style={css('position:relative;width:40px;height:40px;border-radius:14px;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#384152" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
              {attentionCount > 0 && <span style={css('position:absolute;top:7px;right:8px;width:8px;height:8px;border-radius:50%;background:#ef4444;border:1.5px solid #fff;')} />}
            </button>
            <button onClick={() => router.push('/profile')} style={{ ...css("width:40px;height:40px;border-radius:50%;border:none;background:linear-gradient(135deg,#6366f1,#10b981);color:#fff;font-weight:700;font-size:14px;font-family:var(--font-manrope);cursor:pointer;box-shadow:0 4px 10px rgba(99,102,241,.25);"), background: avBg(currentUser.name || 'Admin') }}>{initials(currentUser.name || 'Admin')}</button>
          </div>
        </div>
      </div>

      {loading ? <Loader /> : (
        <div className="m-noscroll" style={{ ...css('flex:1;overflow-y:auto;padding:6px 20px 0;'), paddingBottom: `calc(${BOTTOM(0)} + 96px)` }}>
          {/* stat cards */}
          <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:8px;animation:fadeIn .3s ease;')}>
            {stats.map((s, i) => (
              <div key={i} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:15px;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css(`width:34px;height:34px;border-radius:11px;background:${s.bg};display:flex;align-items:center;justify-content:center;margin-bottom:9px;`)}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={s.stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                </div>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:26px;color:#0f1729;letter-spacing:-.03em;line-height:1;")}>{s.num}</div>
                <div style={css('font-size:12px;color:#8a8f9a;font-weight:600;margin-top:3px;')}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* needs attention */}
          <div style={css('margin-top:22px;')}>
            <div style={css('display:flex;align-items:center;justify-content:space-between;margin-bottom:11px;')}>
              <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;")}>Needs your attention</div>
              {attentionCount > 0 && <span style={css('font-size:11px;font-weight:800;color:#b45309;background:#fef3c7;padding:3px 9px;border-radius:9px;')}>{attentionCount} {attentionCount === 1 ? 'item' : 'items'}</span>}
            </div>
            {attentionCount === 0 ? (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:26px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                <div style={css('width:44px;height:44px;border-radius:14px;background:#e8faf2;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;')}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>
                <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:15px;color:#0f1729;")}>All caught up</div>
                <div style={css('font-size:12px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>No reports or issues to review.</div>
              </div>
            ) : (
              <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                {reports.length > 0 && (
                  <button onClick={() => router.push('/admin/moderation')} style={css('width:100%;display:flex;align-items:center;gap:11px;padding:12px 15px;border:none;border-bottom:1px solid #f4f5f7;background:none;cursor:pointer;text-align:left;')}>
                    <span style={css('width:38px;height:38px;border-radius:11px;background:#fff1f2;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" /></svg></span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{reports.length} reported {reports.length === 1 ? 'message' : 'messages'}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Review in moderation</div></div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c5cad3" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                )}
                {issues.map((iss, idx) => (
                  <div key={iss.id} style={css(`display:flex;align-items:center;gap:11px;padding:12px 15px;${idx < issues.length - 1 ? 'border-bottom:1px solid #f4f5f7;' : ''}`)}>
                    <span style={css('width:38px;height:38px;border-radius:11px;background:#fef6e7;display:flex;align-items:center;justify-content:center;flex:none;')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" /></svg></span>
                    <div style={css('flex:1;min-width:0;')}><div style={css('font-size:13.5px;font-weight:700;color:#1f2734;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')}>{iss.message}</div><div style={css('font-size:11.5px;color:#9aa0ac;font-weight:500;')}>Reported by {iss.reporter_name}</div></div>
                    <button onClick={() => resolveIssue(iss.id)} style={css('font-size:12px;font-weight:700;color:#10b981;background:#e8faf2;border:none;padding:6px 11px;border-radius:9px;cursor:pointer;flex:none;')}>Resolve</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* quick actions */}
          <div style={css('margin-top:22px;')}>
            <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16.5px;letter-spacing:-.02em;color:#0f1729;margin-bottom:11px;")}>Quick actions</div>
            <div style={css('display:grid;grid-template-columns:1fr 1fr;gap:11px;')}>
              {quickActions.map((a, i) => (
                <button key={i} onClick={a.onClick} style={css('background:#fff;border:1px solid #eef0f3;border-radius:16px;padding:15px;display:flex;flex-direction:column;gap:9px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(16,24,40,.04);')}>
                  <span style={css(`width:36px;height:36px;border-radius:11px;background:${a.bg};display:flex;align-items:center;justify-content:center;`)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={a.stroke} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">{a.icon}</svg></span>
                  <span style={css('font-size:13.5px;font-weight:700;color:#1f2734;')}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
