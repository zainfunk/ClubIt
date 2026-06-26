'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiClubAttendance } from '@/lib/school-api'
import { formatHours, DEFAULT_MEETING_MINUTES } from '@/lib/rewards/hours'
import { getAdminSettings } from '@/lib/settings-store'
import { Clock, Pencil, Check, X, Loader2 } from 'lucide-react'
import Avatar from '@/components/Avatar'

interface MemberRow {
  userId: string
  name: string
  autoMinutes: number
  adjustmentMinutes: number
  totalMinutes: number
  attendedMeetings: number
}

interface Props {
  clubId: string
  members: { id: string; name: string }[]
}

export default function MemberHoursTable({ clubId, members }: Props) {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const settings = getAdminSettings()

  const memberIds = useMemo(() => members.map((m) => m.id), [members])

  useEffect(() => {
    if (memberIds.length === 0) {
      setRows([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    // Service-role route so the per-member hours don't silently come back empty
    // under RLS / the iOS-shell JWT bridge.
    apiClubAttendance(clubId)
      .then(({ records, adjustments }) => {
        if (cancelled) return
        const autoByUser = new Map<string, { mins: number; meetings: number }>()
        for (const r of records) {
          if (!r.present) continue
          const cur = autoByUser.get(r.userId) ?? { mins: 0, meetings: 0 }
          cur.mins += r.durationMinutes ?? DEFAULT_MEETING_MINUTES
          cur.meetings += 1
          autoByUser.set(r.userId, cur)
        }
        const newRows: MemberRow[] = members.map((m) => {
          const auto = autoByUser.get(m.id) ?? { mins: 0, meetings: 0 }
          const adj = adjustments[m.id] ?? 0
          return {
            userId: m.id,
            name: m.name,
            autoMinutes: auto.mins,
            adjustmentMinutes: adj,
            totalMinutes: Math.max(0, auto.mins + adj),
            attendedMeetings: auto.meetings,
          }
        }).sort((a, b) => b.totalMinutes - a.totalMinutes)
        setRows(newRows)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setRows([])
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [clubId, memberIds, members])

  function startEdit(row: MemberRow) {
    setEditingId(row.userId)
    setEditValue(String(row.adjustmentMinutes))
  }

  async function save(row: MemberRow) {
    const parsed = parseInt(editValue, 10)
    if (Number.isNaN(parsed)) {
      setEditingId(null)
      return
    }
    setSaving(true)
    const res = await fetch(`/api/clubs/${clubId}/members/${row.userId}/hours`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adjustmentMinutes: parsed }),
    })
    setSaving(false)
    if (!res.ok) {
      console.error('failed to save adjustment', await res.text())
      setEditingId(null)
      return
    }
    setRows((prev) => prev.map((r) =>
      r.userId === row.userId
        ? { ...r, adjustmentMinutes: parsed, totalMinutes: Math.max(0, r.autoMinutes + parsed) }
        : r,
    ))
    setEditingId(null)
  }

  if (!settings.hoursTrackingEnabled) {
    return (
      <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 text-sm text-amber-800">
        Hours tracking is currently disabled school-wide. An admin can enable it in Settings.
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200/60 overflow-hidden"
      style={{ boxShadow: '0 4px 24px rgba(15,23,42,0.04)' }}>
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-manrope)' }}>
          Member hours
        </h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-bold text-slate-400">
          Auto + advisor adjustment
        </span>
      </div>

      {loading ? (
        <div className="p-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-sm text-slate-500 italic">No members yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Member</th>
                <th className="px-3 py-2.5 text-right">Meetings</th>
                <th className="px-3 py-2.5 text-right">Auto</th>
                <th className="px-3 py-2.5 text-right">Adjustment</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isEditing = editingId === row.userId
                return (
                  <tr key={row.userId} className="border-t border-slate-100">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.name} size="sm" />
                        <span className="font-medium text-slate-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                      {row.attendedMeetings}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600 tabular-nums">
                      {formatHours(row.autoMinutes)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="15"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-20 px-2 py-1 text-right rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                          autoFocus
                        />
                      ) : (
                        <span className={row.adjustmentMinutes === 0 ? 'text-slate-400' : row.adjustmentMinutes > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {row.adjustmentMinutes === 0
                            ? '0m'
                            : `${row.adjustmentMinutes > 0 ? '+' : '-'}${formatHours(Math.abs(row.adjustmentMinutes))}`}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'var(--font-manrope)' }}>
                      {formatHours(row.totalMinutes)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => save(row)}
                            disabled={saving}
                            className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40"
                            aria-label="Save"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={saving}
                            className="text-slate-400 hover:text-slate-600 disabled:opacity-40"
                            aria-label="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(row)}
                          className="text-slate-400 hover:text-indigo-600 transition-colors"
                          aria-label="Edit adjustment"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-[11px] text-slate-400 border-t border-slate-100">
        Auto hours come from each check-in's scheduled meeting time. Adjustments are advisor edits in minutes (e.g., <code>+30</code> or <code>-15</code>).
      </p>
    </div>
  )
}
