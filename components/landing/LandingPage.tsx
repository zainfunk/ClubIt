'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import {
  Sparkles,
  Zap,
  BarChart3,
  UserCheck,
  Crown,
  LayoutDashboard,
  Smartphone,
  Monitor,
  Apple,
  Check,
  ArrowRight,
  Menu,
  X,
  ChevronDown,
  Star,
  Compass,
  ShieldCheck,
} from 'lucide-react'

// Marketing landing page — fully public, renders for unauthenticated visitors.
// Only the Log In / Get Started / Subscribe CTAs route to Clerk (/sign-in, /sign-up).
// Everything else stays visual/informational.
export default function LandingPage() {
  const { user, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [capacity, setCapacity] = useState(12)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCapacity((c) => (c >= 30 ? 12 : c + 1))
    }, 180)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="min-h-screen bg-white text-slate-900"
      style={{ fontFamily: 'var(--font-inter)' }}
    >
      {/* ============ NAVBAR ============ */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_4px_24px_rgba(15,23,42,0.04)]'
            : 'bg-transparent'
        }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-xl font-extrabold tracking-tight text-slate-900"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              ClubIt
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#how" className="hover:text-slate-900 transition">How it works</a>
            <a href="#pricing" className="hover:text-slate-900 transition">Pricing</a>
            <a href="#faq" className="hover:text-slate-900 transition">FAQ</a>
          </div>

          <div className="hidden md:flex items-center gap-2">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="px-4 h-9 inline-flex items-center text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-lg shadow-slate-900/10 transition"
                >
                  Dashboard
                </Link>
                <button
                  onClick={() => signOut({ redirectUrl: '/' })}
                  className="px-4 h-9 inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-4 h-9 inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                >
                  Log In
                </Link>
                <Link
                  href="/sign-up"
                  className="px-4 h-9 inline-flex items-center text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-lg shadow-slate-900/10 transition"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          <button
            aria-label="Toggle menu"
            className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-slate-100"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </nav>

        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-slate-200 px-6 py-4 flex flex-col gap-3 text-sm font-medium">
            <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#how" onClick={() => setMobileOpen(false)}>How it works</a>
            <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
            <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
            <div className="flex gap-2 pt-2">
              {isSignedIn ? (
                <>
                  <Link href="/dashboard" className="flex-1 h-10 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white font-semibold">Dashboard</Link>
                  <button onClick={() => signOut({ redirectUrl: '/' })} className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 font-semibold">Sign Out</button>
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="flex-1 h-10 inline-flex items-center justify-center rounded-lg border border-slate-200 font-semibold">Log In</Link>
                  <Link href="/sign-up" className="flex-1 h-10 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white font-semibold">Get Started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ============ HERO ============ */}
      <section className="relative pt-32 lg:pt-40 pb-20 overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] rounded-full bg-gradient-to-br from-indigo-100 via-emerald-50 to-transparent blur-3xl opacity-70" />
          <div className="absolute top-40 right-10 w-72 h-72 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-indigo-200/40 blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 backdrop-blur border border-indigo-100 text-xs font-semibold text-indigo-700 mb-6 shadow-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Built for high schools
            </div>
            <h1
              className="text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-slate-900 mb-6"
              style={{ fontFamily: 'var(--font-manrope)' }}
            >
              Run your school's clubs{' '}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 bg-clip-text text-transparent">
                  without the chaos.
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 9 Q 75 2 150 6 T 298 4" stroke="url(#grad)" strokeWidth="3" strokeLinecap="round" fill="none" />
                  <defs>
                    <linearGradient id="grad" x1="0" x2="1">
                      <stop offset="0" stopColor="#6366f1" />
                      <stop offset="1" stopColor="#10b981" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h1>
            <p className="text-lg text-slate-600 max-w-xl leading-relaxed mb-8">
              ClubIt streamlines how students discover clubs, how teachers manage them,
              and how admins keep everything running — all in one place, on every device.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-xl shadow-slate-900/20 transition-all hover:scale-[1.02]"
              >
                Get Started — $500/year
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 h-12 px-6 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold hover:bg-slate-50 transition"
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Right side: animated mockup */}
          <div className="relative h-[480px] lg:h-[560px]">
            {/* Laptop */}
            <div className="absolute top-8 left-0 right-4 rounded-2xl bg-slate-900 p-2 shadow-2xl shadow-slate-900/20 rotate-[-1.5deg]">
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400" />
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                <div className="w-2 h-2 rounded-full bg-green-400" />
              </div>
              <div className="rounded-xl bg-gradient-to-br from-slate-50 to-white p-4 h-64">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold" style={{ fontFamily: 'var(--font-manrope)' }}>Browse Clubs</div>
                  <div className="text-xs text-slate-400">Fall 2026</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Chess Club', emoji: '♟️', filled: 24, max: 30, color: 'indigo' },
                    { name: 'Robotics', emoji: '🤖', filled: 30, max: 30, color: 'rose' },
                    { name: 'Art Club', emoji: '🎨', filled: 18, max: 25, color: 'emerald' },
                    { name: 'Debate', emoji: '🎤', filled: 22, max: 28, color: 'amber' },
                  ].map((c) => {
                    const pct = (c.filled / c.max) * 100
                    const full = c.filled >= c.max
                    return (
                      <div key={c.name} className="rounded-lg bg-white border border-slate-100 p-2.5 shadow-sm">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm">{c.emoji}</span>
                            <span className="text-[11px] font-semibold truncate">{c.name}</span>
                          </div>
                          {full && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600">FULL</span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              full ? 'bg-rose-400' : 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[9px] text-slate-400 mt-1">{c.filled}/{c.max} seats</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Phone mockup */}
            <div className="absolute bottom-0 right-0 w-48 rounded-[2rem] bg-slate-900 p-1.5 shadow-2xl shadow-slate-900/30 rotate-[4deg] border border-slate-800">
              <div className="rounded-[1.6rem] bg-gradient-to-b from-indigo-50 to-white overflow-hidden">
                <div className="h-4 flex items-center justify-center">
                  <div className="w-16 h-1 rounded-full bg-slate-900" />
                </div>
                <div className="px-3 pb-3 pt-1">
                  <div className="text-[10px] font-bold mb-2" style={{ fontFamily: 'var(--font-manrope)' }}>Join a Club</div>
                  <div className="rounded-xl bg-white border border-indigo-100 p-2 mb-1.5 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">♟️</span>
                      <span className="text-[10px] font-bold">Chess Club</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-200"
                        style={{ width: `${(capacity / 30) * 100}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[8px] text-slate-400">{capacity}/30 seats</span>
                      <button className="text-[8px] font-bold text-white bg-indigo-600 rounded-full px-2 py-0.5">JOIN</button>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-100 p-2 shadow-sm">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">🎨</span>
                      <span className="text-[10px] font-bold">Art Club</span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating cards */}
            <div className="hidden lg:block absolute top-0 right-20 rounded-xl bg-white shadow-xl shadow-slate-900/10 border border-slate-100 px-3 py-2 animate-bounce" style={{ animationDuration: '3s' }}>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs">✅</div>
                <div>
                  <div className="text-[10px] text-slate-400">Just joined</div>
                  <div className="text-xs font-bold">Chess Club — 24/30</div>
                </div>
              </div>
            </div>
            <div className="hidden lg:block absolute bottom-32 left-0 rounded-xl bg-white shadow-xl shadow-slate-900/10 border border-slate-100 px-3 py-2 animate-bounce" style={{ animationDuration: '4s', animationDelay: '0.5s' }}>
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <div className="text-xs font-bold">Leader assigned</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 mb-4">
              Features
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              Everything clubs need, nothing they don't.
            </h2>
            <p className="text-lg text-slate-600">
              From browsing to sign-ups to leadership, ClubIt is built for the way high schools actually work.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Browse Clubs */}
            <FeatureCard
              accent="indigo"
              icon={<Compass className="w-5 h-5" />}
              title="Browse Clubs"
              desc="A beautiful grid of every club at your school, with cover images and live capacity meters."
            >
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Chess', emoji: '♟️', pct: 80 },
                  { name: 'Art', emoji: '🎨', pct: 72 },
                  { name: 'Robotics', emoji: '🤖', pct: 100 },
                  { name: 'Debate', emoji: '🎤', pct: 65 },
                ].map((c) => (
                  <div key={c.name} className="rounded-lg bg-white p-2 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs font-bold mb-1">
                      <span>{c.emoji}</span> {c.name}
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>

            {/* One-tap Sign Up */}
            <FeatureCard
              accent="emerald"
              icon={<Zap className="w-5 h-5" />}
              title="One-tap Sign-Up"
              desc="Students join clubs with a single tap. No paperwork, no email chains, no missed deadlines."
            >
              <div className="flex items-center justify-center py-4 relative">
                <div className="relative">
                  <button className="h-10 px-6 rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 text-white text-sm font-bold shadow-lg shadow-emerald-500/30 animate-pulse">
                    Join Chess Club
                  </button>
                  <span className="absolute -top-2 -right-2 text-lg">✨</span>
                  <span className="absolute -bottom-1 -left-3 text-sm">🎉</span>
                  <span className="absolute -top-3 left-6 text-xs">⭐</span>
                </div>
              </div>
            </FeatureCard>

            {/* Capacity */}
            <FeatureCard
              accent="amber"
              icon={<BarChart3 className="w-5 h-5" />}
              title="Capacity Management"
              desc="Set a max for every club. Watch live as spots fill up and new members are gated out."
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>Chess Club</span>
                  <span className="text-slate-500">{capacity}/30</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-indigo-500 to-emerald-500 transition-all"
                    style={{ width: `${(capacity / 30) * 100}%` }}
                  />
                </div>
                {capacity >= 30 && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">FULL</span>
                )}
              </div>
            </FeatureCard>

            {/* Teacher assignment */}
            <FeatureCard
              accent="sky"
              icon={<UserCheck className="w-5 h-5" />}
              title="Teacher-in-Charge"
              desc="Admins assign a faculty advisor to every club with a single dropdown. No spreadsheets."
            >
              <div className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold">MR</div>
                    <div>
                      <div className="text-xs font-bold">Ms. Rivera</div>
                      <div className="text-[10px] text-slate-400">Chess Club advisor</div>
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </div>
              </div>
            </FeatureCard>

            {/* Student leaders */}
            <FeatureCard
              accent="rose"
              icon={<Crown className="w-5 h-5" />}
              title="Student Leaders"
              desc="Pin presidents, treasurers, and captains. Give them permissions to manage the club."
            >
              <div className="rounded-xl bg-white border border-slate-100 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">♟️</span>
                  <span className="text-xs font-bold">Chess Club</span>
                  <Crown className="w-3 h-3 text-amber-500 ml-auto" />
                </div>
                <div className="flex -space-x-2">
                  {['JK', 'SM', 'AL', 'TP'].map((i, idx) => (
                    <div
                      key={i}
                      className={`w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-bold text-white ${
                        ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'][idx]
                      }`}
                    >
                      {i}
                    </div>
                  ))}
                </div>
              </div>
            </FeatureCard>

            {/* Role-based dashboards */}
            <FeatureCard
              accent="violet"
              icon={<LayoutDashboard className="w-5 h-5" />}
              title="Role-Based Dashboards"
              desc="Students, teachers, and admins each get a view tailored exactly to what they need."
            >
              <div className="space-y-1.5">
                {[
                  { label: 'Student', color: 'bg-emerald-100 text-emerald-700' },
                  { label: 'Teacher', color: 'bg-indigo-100 text-indigo-700' },
                  { label: 'Admin', color: 'bg-rose-100 text-rose-700' },
                ].map((r) => (
                  <div key={r.label} className="flex items-center gap-2 rounded-lg bg-white border border-slate-100 p-2 shadow-sm">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${r.color}`}>
                      {r.label}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            </FeatureCard>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how" className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 mb-4">
              How it works
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              Three steps from chaos to clarity.
            </h2>
          </div>

          <div className="relative grid md:grid-cols-3 gap-8">
            {/* Connecting dotted line */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 border-t-2 border-dashed border-slate-300" />

            {[
              {
                n: 1,
                title: 'Admins set up clubs',
                desc: 'Create clubs, set capacity, and assign a teacher-in-charge from one admin panel.',
                preview: (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
                      <span className="text-sm">♟️</span>
                      <span className="text-xs font-bold">New Club</span>
                    </div>
                    <div className="rounded-md border border-slate-200 p-2 text-xs text-slate-500">Max: 30</div>
                    <div className="rounded-md border border-slate-200 p-2 text-xs text-slate-500 flex items-center justify-between">
                      Teacher: Ms. Rivera <ChevronDown className="w-3 h-3" />
                    </div>
                  </div>
                ),
              },
              {
                n: 2,
                title: 'Students browse & join',
                desc: "Students tap through clubs on their phone, filter by interest, and join in seconds.",
                preview: (
                  <div className="space-y-1.5">
                    <div className="flex gap-1 flex-wrap">
                      {['All', 'Sports', 'Arts', 'STEM'].map((t, i) => (
                        <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 flex items-center justify-between">
                      <span className="text-xs font-bold">🎨 Art Club</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">JOIN</span>
                    </div>
                    <div className="rounded-md bg-slate-50 p-2 flex items-center justify-between">
                      <span className="text-xs font-bold">♟️ Chess</span>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">JOIN</span>
                    </div>
                  </div>
                ),
              },
              {
                n: 3,
                title: 'Everyone stays in sync',
                desc: "Live sign-up counts, rosters, and leadership updates — everyone sees the same thing.",
                preview: (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">Sign-ups today</span>
                      <span className="text-emerald-600 font-bold">+42</span>
                    </div>
                    <div className="h-10 flex items-end gap-1">
                      {[40, 55, 30, 70, 45, 85, 60].map((h, i) => (
                        <div key={i} className="flex-1 rounded-sm bg-gradient-to-t from-indigo-500 to-emerald-400" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                  </div>
                ),
              },
            ].map((step) => (
              <div key={step.n} className="relative">
                <div className="w-12 h-12 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center text-xl font-extrabold text-slate-900 mx-auto mb-6 shadow-lg relative z-10" style={{ fontFamily: 'var(--font-manrope)' }}>
                  {step.n}
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/5 p-5 mb-5">
                  {step.preview}
                </div>
                <h3 className="text-lg font-bold mb-2 text-center" style={{ fontFamily: 'var(--font-manrope)' }}>
                  {step.title}
                </h3>
                <p className="text-sm text-slate-600 text-center leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 flex items-center justify-center gap-6 text-sm text-slate-500">
            <span className="font-semibold">Works on</span>
            <div className="flex items-center gap-2"><Apple className="w-4 h-4" /> iOS</div>
            <div className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Android</div>
            <div className="flex items-center gap-2"><Monitor className="w-4 h-4" /> Web</div>
          </div>
        </div>
      </section>

      {/* ============ MOBILE SHOWCASE ============ */}
      <section className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700 mb-4">
              Mobile-first
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-6" style={{ fontFamily: 'var(--font-manrope)' }}>
              Built mobile-first, because students live on their phones.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-6">
              ClubIt runs natively on iOS and Android, with a fast responsive web app for teachers and admins.
              No app fatigue — just the features students actually use.
            </p>
            <ul className="space-y-3 text-slate-700">
              {[
                'Browse every club with covers and descriptions',
                'Get push notifications when your club meets',
                'Leader tools for managing rosters on the go',
                "Works offline — syncs when you're back online",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative h-[520px] flex items-center justify-center">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-[420px] h-[420px] rounded-full bg-gradient-to-br from-indigo-100 via-emerald-50 to-transparent blur-2xl" />
            </div>
            <div className="relative flex items-center gap-4">
              <PhoneMockup tilt="-6deg" screen={
                <div className="p-3">
                  <div className="text-xs font-bold mb-2" style={{ fontFamily: 'var(--font-manrope)' }}>Chess Club</div>
                  <div className="rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 h-20 mb-2" />
                  <div className="text-[10px] text-slate-600 mb-2">Meets Tuesdays, 3pm in Room 204.</div>
                  <button className="w-full h-7 rounded-full bg-indigo-600 text-white text-[10px] font-bold">Join Club</button>
                </div>
              } />
              <PhoneMockup tilt="2deg" screen={
                <div className="p-3 text-center">
                  <div className="text-3xl mb-2">🎉</div>
                  <div className="text-xs font-bold mb-1" style={{ fontFamily: 'var(--font-manrope)' }}>You're in!</div>
                  <div className="text-[10px] text-slate-500 mb-3">Welcome to Chess Club</div>
                  <button className="w-full h-6 rounded-full bg-slate-900 text-white text-[10px] font-bold">View Club</button>
                </div>
              } />
              <PhoneMockup tilt="8deg" screen={
                <div className="p-3">
                  <div className="text-xs font-bold mb-2 flex items-center gap-1" style={{ fontFamily: 'var(--font-manrope)' }}>
                    Leader <Crown className="w-3 h-3 text-amber-500" />
                  </div>
                  <div className="space-y-1.5">
                    {['Jamie K', 'Sara M', 'Alex L'].map((n, i) => (
                      <div key={n} className="flex items-center gap-1.5 rounded-md bg-slate-50 p-1.5">
                        <div className={`w-5 h-5 rounded-full text-[8px] text-white font-bold flex items-center justify-center ${['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'][i]}`}>
                          {n[0]}
                        </div>
                        <span className="text-[10px] font-semibold">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              } />
            </div>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section id="pricing" className="py-24 bg-gradient-to-b from-white via-indigo-50/30 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 mb-4">
              Pricing
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              One price. One school. Everything included.
            </h2>
            <p className="text-lg text-slate-600">No per-seat fees, no gotchas, no upsells.</p>
          </div>

          <div className="relative max-w-lg mx-auto">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-400 to-emerald-400 blur-2xl opacity-30" />
            <div className="relative rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-indigo-900/10 p-10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">ClubIt for Schools</div>
                  <div className="text-xl font-bold mt-1" style={{ fontFamily: 'var(--font-manrope)' }}>Annual plan</div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-emerald-500 text-white shadow-lg">
                  Everything included
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-6xl font-extrabold tracking-tight" style={{ fontFamily: 'var(--font-manrope)' }}>
                  $500
                </span>
                <span className="text-lg text-slate-500 font-semibold">/ year</span>
              </div>
              <p className="text-slate-600 mb-8">One flat rate. Unlimited students, teachers, and clubs.</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited clubs',
                  'Unlimited students',
                  'Admin, teacher, and student roles',
                  'Live capacity tracking',
                  'Mobile + web apps (iOS, Android, browser)',
                  'Priority support',
                  'Free updates forever',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-slate-700">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm font-medium">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/subscribe"
                className="group w-full inline-flex items-center justify-center gap-2 h-14 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-xl shadow-slate-900/20 transition-all hover:scale-[1.01]"
              >
                Subscribe — $500/year
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <p className="text-center text-xs text-slate-500 mt-4">
                Billed annually. Cancel anytime. Purchase orders accepted for schools.
              </p>

              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  {['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay'].map((m) => (
                    <span key={m} className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                      {m}
                    </span>
                  ))}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200">
                    School PO
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              Loved by students, teachers, and principals.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                quote: "I signed up for three clubs in like 30 seconds. Our old system was a Google Form from 2015.",
                name: 'Maya Patel',
                role: 'Junior, Student',
                school: 'Westview High',
                avatar: 'bg-gradient-to-br from-indigo-400 to-purple-500',
                initial: 'MP',
              },
              {
                quote: "As a club advisor, I finally know who's actually in my club. Rosters update themselves. It's a small thing but it changed my year.",
                name: 'Ms. Rivera',
                role: 'Teacher, Chess Club Advisor',
                school: 'Lakeside Prep',
                avatar: 'bg-gradient-to-br from-emerald-400 to-teal-500',
                initial: 'MR',
              },
              {
                quote: "Club season used to be a spreadsheet nightmare for our office. ClubIt killed the chaos. Worth every dollar.",
                name: 'Dr. Chen',
                role: 'Principal',
                school: 'Northgate Academy',
                avatar: 'bg-gradient-to-br from-rose-400 to-amber-500',
                initial: 'DC',
              },
            ].map((t) => (
              <div key={t.name} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-xl shadow-slate-900/5">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed mb-6">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-full ${t.avatar} flex items-center justify-center text-white font-bold`}>
                    {t.initial}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role} · {t.school}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="py-24 bg-slate-50/50">
        <div className="max-w-3xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              Questions, answered.
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: 'Is there a free trial?',
                a: 'Yes — schools can try ClubIt free for 30 days, no credit card required. You only pay when you\'re ready to commit.',
              },
              {
                q: 'How does billing work?',
                a: 'One flat $500/year fee per school, billed annually. We accept credit cards, Apple Pay, Google Pay, and school purchase orders.',
              },
              {
                q: 'Can we import existing club rosters?',
                a: 'Absolutely. Upload a CSV or sync from your existing SIS. We\'ll map fields automatically and you\'ll be live in under an hour.',
              },
              {
                q: 'What happens when a club is full?',
                a: 'New students see a "Full" badge and can join a waitlist. If a member drops, the next person on the waitlist is notified automatically.',
              },
              {
                q: 'Is student data private?',
                a: 'Completely. We\'re FERPA-compliant, encrypted end-to-end, and never sell data. Student info is visible only to authorized school staff.',
              },
            ].map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl bg-white border border-slate-200 overflow-hidden"
              >
                <summary className="list-none cursor-pointer px-6 py-5 flex items-center justify-between font-bold text-slate-900 hover:bg-slate-50 transition">
                  <span>{f.q}</span>
                  <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-6 pb-5 text-slate-600 leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-5xl mx-auto relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-emerald-500 p-12 lg:p-16 text-center shadow-2xl shadow-indigo-900/30">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4" style={{ fontFamily: 'var(--font-manrope)' }}>
              Ready to fix club season?
            </h2>
            <p className="text-lg text-indigo-100 mb-8 max-w-xl mx-auto">
              Join 40+ schools who've already ditched the spreadsheets.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-slate-900 font-bold shadow-xl hover:scale-[1.02] transition-all"
              >
                Get Started — $500/year
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/sign-in" className="text-indigo-100 hover:text-white text-sm font-semibold underline underline-offset-4">
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-emerald-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-extrabold" style={{ fontFamily: 'var(--font-manrope)' }}>ClubIt</span>
              </div>
              <p className="text-sm text-slate-500 max-w-xs">
                The club management app for high schools that actually gets how high schools work.
              </p>
            </div>
            {[
              { title: 'Product', items: ['Features', 'How it works', 'Pricing', 'FAQ'] },
              { title: 'Company', items: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', items: ['Privacy', 'Terms', 'FERPA', 'Security'] },
            ].map((col) => (
              <div key={col.title}>
                <div className="font-bold text-sm mb-3" style={{ fontFamily: 'var(--font-manrope)' }}>{col.title}</div>
                <ul className="space-y-2 text-sm text-slate-500">
                  {col.items.map((i) => (
                    <li key={i}><a href="#" className="hover:text-slate-900 transition">{i}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-slate-100">
            <div className="text-xs text-slate-400">© 2026 ClubIt. Made for high schools everywhere.</div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              FERPA-compliant · SOC 2 in progress
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ==================== Subcomponents ====================

function FeatureCard({
  icon,
  title,
  desc,
  accent,
  children,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  accent: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' | 'violet'
  children: React.ReactNode
}) {
  const accentMap = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-500/20',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
    sky: 'from-sky-500 to-sky-600 shadow-sky-500/20',
    rose: 'from-rose-500 to-rose-600 shadow-rose-500/20',
    violet: 'from-violet-500 to-violet-600 shadow-violet-500/20',
  }
  return (
    <div className="group rounded-2xl bg-white border border-slate-200 p-6 shadow-xl shadow-slate-900/5 hover:shadow-2xl hover:shadow-slate-900/10 hover:-translate-y-0.5 transition-all">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentMap[accent]} text-white flex items-center justify-center shadow-lg mb-4`}>
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-1" style={{ fontFamily: 'var(--font-manrope)' }}>
        {title}
      </h3>
      <p className="text-sm text-slate-600 mb-5 leading-relaxed">{desc}</p>
      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">{children}</div>
    </div>
  )
}

function PhoneMockup({ tilt, screen }: { tilt: string; screen: React.ReactNode }) {
  return (
    <div
      className="w-40 rounded-[1.8rem] bg-slate-900 p-1.5 shadow-2xl shadow-slate-900/30 border border-slate-800"
      style={{ transform: `rotate(${tilt})` }}
    >
      <div className="rounded-[1.5rem] bg-white overflow-hidden">
        <div className="h-3 flex items-center justify-center">
          <div className="w-12 h-1 rounded-full bg-slate-900" />
        </div>
        {screen}
      </div>
    </div>
  )
}
