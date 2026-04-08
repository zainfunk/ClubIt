'use client'

import Link from 'next/link'
import {
  ATTENDANCE_RECORDS,
  CHAT_MESSAGES,
  CLUBS,
  CLUB_FORMS,
  CLUB_NEWS,
  EVENTS,
  JOIN_REQUESTS,
  POLLS,
  SCHOOL_ELECTIONS,
  USERS,
} from '@/lib/mock-data'
import { BarChart3, Calendar, MessageSquare, Shield, Users } from 'lucide-react'

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-[0_8px_24px_rgba(0,0,0,0.04)] border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
        <div className="text-[#0058be]">{icon}</div>
      </div>
      <p
        className="text-3xl font-black text-gray-900"
        style={{ fontFamily: 'var(--font-manrope)' }}
      >
        {value}
      </p>
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl bg-white border border-gray-100 shadow-[0_8px_24px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2
          className="text-lg font-bold text-gray-900"
          style={{ fontFamily: 'var(--font-manrope)' }}
        >
          {title}
        </h2>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

export default function DemoPage() {
  const studentCount = USERS.filter((user) => user.role === 'student').length
  const advisorCount = USERS.filter((user) => user.role === 'advisor').length

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0058be] mb-2">
            Separate Demo Space
          </p>
          <h1
            className="text-4xl font-black tracking-tight text-gray-900"
            style={{ fontFamily: 'var(--font-manrope)' }}
          >
            Mock Data Browser
          </h1>
          <p className="text-gray-500 text-sm mt-3 max-w-2xl leading-relaxed">
            This page keeps the seeded demo people, clubs, forms, elections, attendance,
            and chat content in one isolated place so the main app can stay focused on
            real school data.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-[#0058be] px-5 py-3 text-sm font-bold text-white hover:bg-[#0048a0] transition-colors"
        >
          Back To Live App
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard label="Mock Users" value={USERS.length} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Mock Clubs" value={CLUBS.length} icon={<Shield className="w-5 h-5" />} />
        <StatCard label="Mock Events" value={EVENTS.length} icon={<Calendar className="w-5 h-5" />} />
        <StatCard label="Mock Forms" value={CLUB_FORMS.length + POLLS.length + SCHOOL_ELECTIONS.length} icon={<BarChart3 className="w-5 h-5" />} />
        <StatCard label="Mock Chat" value={CHAT_MESSAGES.length} icon={<MessageSquare className="w-5 h-5" />} />
      </div>

      <Section
        title="People"
        description="Seeded users kept for demos, previews, and fallback reference while we finish the real data migration."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Students</p>
            <p className="text-2xl font-bold text-gray-900">{studentCount}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Advisors</p>
            <p className="text-2xl font-bold text-gray-900">{advisorCount}</p>
          </div>
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Admins</p>
            <p className="text-2xl font-bold text-gray-900">{USERS.length - studentCount - advisorCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {USERS.map((user) => (
            <div key={user.id} className="rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest rounded-full bg-gray-100 px-2 py-1 text-gray-600">
                  {user.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Clubs"
        description="All seeded clubs, along with the baked-in member counts and tag groupings."
      >
        <div className="grid gap-4 md:grid-cols-2">
          {CLUBS.map((club) => (
            <div key={club.id} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center text-2xl shrink-0">
                  {club.iconUrl ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900">{club.name}</p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {club.memberIds.length}/{club.capacity ?? '∞'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{club.description}</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(club.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-bold uppercase tracking-widest rounded-full bg-blue-50 px-2 py-1 text-[#0058be]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-2">
        <Section
          title="Activities"
          description="Seeded events, forms, polls, and school elections kept together for reference."
        >
          <div className="space-y-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Events</p>
              <div className="space-y-2">
                {EVENTS.map((event) => (
                  <div key={event.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="font-medium text-gray-900">{event.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {event.clubId} · {event.date} · {event.location ?? 'No location'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Club Forms</p>
              <div className="space-y-2">
                {CLUB_FORMS.map((form) => (
                  <div key={form.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="font-medium text-gray-900">{form.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.clubId} · {form.formType} · {form.isOpen ? 'Open' : 'Closed'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Elections And Polls</p>
              <div className="space-y-2">
                {SCHOOL_ELECTIONS.map((election) => (
                  <div key={election.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="font-medium text-gray-900">{election.positionTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      School election · {election.isOpen ? 'Open' : 'Closed'}
                    </p>
                  </div>
                ))}
                {POLLS.map((poll) => (
                  <div key={poll.id} className="rounded-xl bg-gray-50 px-4 py-3">
                    <p className="font-medium text-gray-900">{poll.positionTitle}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {poll.clubId} · Club poll · {poll.isOpen ? 'Open' : 'Closed'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Operational Mock Records"
          description="Join requests, attendance, news, and chat kept out of the live school workflows."
        >
          <div className="grid gap-5">
            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Join Requests</p>
              <p className="text-2xl font-bold text-gray-900">{JOIN_REQUESTS.length}</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Attendance Records</p>
              <p className="text-2xl font-bold text-gray-900">{ATTENDANCE_RECORDS.length}</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Club News Posts</p>
              <p className="text-2xl font-bold text-gray-900">{CLUB_NEWS.length}</p>
            </div>

            <div className="rounded-xl bg-gray-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Chat Messages</p>
              <p className="text-2xl font-bold text-gray-900">{CHAT_MESSAGES.length}</p>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-3">
              <p className="text-sm font-semibold text-gray-800">Why this page exists</p>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                We can keep the mock dataset available for design checks, regression testing,
                and reference content without letting it blur into the live school experience.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
