'use client'

import { useState, useEffect } from 'react'
import { useMockAuth } from '@/lib/mock-auth'
import {
  getAdminSettings, getUserPrivacy,
  fetchAdminSettings, fetchUserPrivacy,
  persistAdminSettings, persistUserPrivacy,
  AdminSettings, UserPrivacySettings,
} from '@/lib/settings-store'
import { useAppSettings } from '@/components/SettingsProvider'
import { supabase } from '@/lib/supabase'
import {
  Moon, Sun, Shield, Eye, EyeOff, Users, Trophy,
  Calendar, Share2, AlertCircle, ChevronRight, Lock, CheckCircle,
} from 'lucide-react'

// ── Toggle component ───────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      }`}
      style={{ background: checked ? '#6366f1' : '#d1d5db' }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
          {icon}
        </div>
        <h2 className="font-bold text-slate-900 text-sm" style={{ fontFamily: 'var(--font-manrope)' }}>{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">{children}</div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  control,
  disabled,
}: {
  label: string
  description?: string
  control: React.ReactNode
  disabled?: boolean
}) {
  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-3.5 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {control}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { currentUser, schoolPrincipal, schoolContactEmail } = useMockAuth()
  const { darkMode, toggleDarkMode } = useAppSettings()
  const isAdmin = currentUser.role === 'admin'
  const isStudent = currentUser.role === 'student'

  // Load settings after mount (avoid SSR/localStorage mismatch)
  const [adminSettings, setAdminState] = useState<AdminSettings>({
    achievementsFeatureEnabled: true,
    attendanceFeatureEnabled: true,
    clubsFeatureEnabled: true,
    studentSocialsEnabled: true,
  })
  const [privacy, setPrivacyState] = useState<UserPrivacySettings>({
    achievementsPublic: true,
    attendancePublic: false,
    clubsPublic: true,
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!currentUser.id) return
    // Show localStorage cache immediately (no flicker), then sync from Supabase
    setAdminState(getAdminSettings())
    setPrivacyState(getUserPrivacy(currentUser.id))
    setLoaded(true)

    void fetchAdminSettings().then(setAdminState)
    void fetchUserPrivacy(currentUser.id).then(setPrivacyState)
  }, [currentUser.id])

  function updateAdmin(partial: Partial<AdminSettings>) {
    setAdminState((p) => ({ ...p, ...partial }))
    void persistAdminSettings(partial)
  }

  function updatePrivacy(partial: Partial<UserPrivacySettings>) {
    setPrivacyState((p) => ({ ...p, ...partial }))
    void persistUserPrivacy(currentUser.id, partial)
  }

  // ── Report issue ──
  const [issueText, setIssueText] = useState('')
  const [issueSubmitted, setIssueSubmitted] = useState(false)
  const [issueSubmitting, setIssueSubmitting] = useState(false)

  async function submitIssue() {
    if (!issueText.trim()) return
    setIssueSubmitting(true)
    await supabase.from('issue_reports').insert({
      school_id: currentUser.schoolId ?? null,
      reporter_id: currentUser.id,
      reporter_name: currentUser.name,
      reporter_email: currentUser.email,
      message: issueText.trim(),
      status: 'open',
    })
    setIssueText('')
    setIssueSubmitted(true)
    setIssueSubmitting(false)
    setTimeout(() => setIssueSubmitted(false), 3000)
  }

  if (!loaded) return null

  return (
    <div className="max-w-2xl mx-auto space-y-5" style={{ fontFamily: 'var(--font-inter)' }}>

      {/* ── Appearance ── */}
      <Section title="Appearance" icon={<Sun className="w-4 h-4" />}>
        <SettingRow
          label="Dark Mode"
          description="Switch between light and dark interface themes."
          control={
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-gray-400" />
              <Toggle checked={darkMode} onChange={toggleDarkMode} />
              <Moon className="w-4 h-4 text-gray-400" />
            </div>
          }
        />
      </Section>

      {/* ── Privacy (student & advisor) ── */}
      {(isStudent || currentUser.role === 'advisor') && (
        <Section title="Privacy" icon={<Eye className="w-4 h-4" />}>
          {isStudent && (
            <>
              <SettingRow
                label="Show my achievements to other students"
                description="When on, other students can see your earned achievements on your profile."
                disabled={!adminSettings.achievementsFeatureEnabled}
                control={
                  <Toggle
                    checked={privacy.achievementsPublic}
                    onChange={(v) => updatePrivacy({ achievementsPublic: v })}
                    disabled={!adminSettings.achievementsFeatureEnabled}
                  />
                }
              />
              {!adminSettings.achievementsFeatureEnabled && (
                <div className="px-5 py-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Disabled by admin — achievement visibility is turned off school-wide.
                </div>
              )}

              <SettingRow
                label="Show my attendance to other students"
                description="When on, other students can see your club attendance records on your profile."
                disabled={!adminSettings.attendanceFeatureEnabled}
                control={
                  <Toggle
                    checked={privacy.attendancePublic}
                    onChange={(v) => updatePrivacy({ attendancePublic: v })}
                    disabled={!adminSettings.attendanceFeatureEnabled}
                  />
                }
              />
              {!adminSettings.attendanceFeatureEnabled && (
                <div className="px-5 py-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Disabled by admin — attendance visibility is turned off school-wide.
                </div>
              )}

              <SettingRow
                label="Show my club memberships to other students"
                description="When on, other students can see which clubs you belong to on your profile."
                disabled={!adminSettings.clubsFeatureEnabled}
                control={
                  <Toggle
                    checked={privacy.clubsPublic}
                    onChange={(v) => updatePrivacy({ clubsPublic: v })}
                    disabled={!adminSettings.clubsFeatureEnabled}
                  />
                }
              />
              {!adminSettings.clubsFeatureEnabled && (
                <div className="px-5 py-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50">
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  Disabled by admin — club visibility is turned off school-wide.
                </div>
              )}
            </>
          )}

          {isStudent && (
            <SettingRow
              label="Allow personal social media links on my profile"
              description="When on, you can add links to your personal Instagram, Twitter, etc."
              disabled={!adminSettings.studentSocialsEnabled}
              control={
                <Toggle
                  checked={adminSettings.studentSocialsEnabled}
                  onChange={() => {}}
                  disabled
                />
              }
            />
          )}
          {isStudent && !adminSettings.studentSocialsEnabled && (
            <div className="px-5 py-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50/50">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Disabled by admin — personal social media links are not permitted.
            </div>
          )}
        </Section>
      )}

      {/* ── Admin controls ── */}
      {isAdmin && (
        <Section title="Student Feature Controls" icon={<Shield className="w-4 h-4" />}>
          <div className="px-5 py-2.5 bg-rose-50/80 border-b border-rose-100">
            <p className="text-xs text-rose-700 font-medium">
              These settings apply to all students school-wide.
            </p>
          </div>

          <SettingRow
            label="Allow students to show achievements"
            description="When off, no student can make their achievements visible to peers — the section is hidden for all students."
            control={
              <Toggle
                checked={adminSettings.achievementsFeatureEnabled}
                onChange={(v) => updateAdmin({ achievementsFeatureEnabled: v })}
              />
            }
          />

          <SettingRow
            label="Allow students to show attendance"
            description="When off, students cannot make their attendance records visible to peers."
            control={
              <Toggle
                checked={adminSettings.attendanceFeatureEnabled}
                onChange={(v) => updateAdmin({ attendanceFeatureEnabled: v })}
              />
            }
          />

          <SettingRow
            label="Allow students to show club memberships"
            description="When off, club lists on student profiles are hidden from peer viewing."
            control={
              <Toggle
                checked={adminSettings.clubsFeatureEnabled}
                onChange={(v) => updateAdmin({ clubsFeatureEnabled: v })}
              />
            }
          />

          <SettingRow
            label="Allow students to add personal social media"
            description="When off, students cannot add personal social links (Instagram, Twitter, etc.) to their profiles. Club social links are unaffected."
            control={
              <Toggle
                checked={adminSettings.studentSocialsEnabled}
                onChange={(v) => updateAdmin({ studentSocialsEnabled: v })}
              />
            }
          />
        </Section>
      )}

      {/* ── Report an issue ── */}
      <Section title="Report an Issue" icon={<AlertCircle className="w-4 h-4" />}>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-600">
            Your report goes to{' '}
            <span className="font-semibold text-slate-800">{schoolPrincipal ?? 'the admin'}</span>.
          </p>
          {issueSubmitted ? (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-2.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              Report submitted — the admin has been notified.
            </div>
          ) : (
            <>
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                rows={3}
                placeholder="Describe the issue…"
                className="w-full text-sm rounded-lg px-4 py-3 resize-none bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300"
              />
              <button
                onClick={submitIssue}
                disabled={!issueText.trim() || issueSubmitting}
                className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {issueSubmitting ? 'Sending…' : 'Send Report'}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </Section>

    </div>
  )
}
