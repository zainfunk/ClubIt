// Shared wrapper for the public legal/support pages (privacy, terms, support).
// Self-contained inline styles so it renders identically regardless of where
// it's reached (logged out, App Review in Safari, etc.). These routes are
// public (see proxy.ts) and rendered bare (see AppShell BARE_ROUTES).

import Link from 'next/link'
import type { ReactNode } from 'react'

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated?: string
  children: ReactNode
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', color: '#1f2734' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 22px 80px' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#6366f1', fontWeight: 700, fontSize: 15 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>C</span>
          ClubIt
        </Link>

        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.02em', color: '#0f1729', margin: '26px 0 6px' }}>{title}</h1>
        {lastUpdated && <p style={{ fontSize: 13, color: '#9aa0ac', margin: 0 }}>Last updated: {lastUpdated}</p>}

        <article style={{ marginTop: 26, fontSize: 15.5, lineHeight: 1.65, color: '#36404e' }}>
          {children}
        </article>

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: '1px solid #e6e8ec', fontSize: 14, color: '#9aa0ac', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ color: '#6366f1', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: '#6366f1', textDecoration: 'none' }}>Terms</Link>
          <Link href="/support" style={{ color: '#6366f1', textDecoration: 'none' }}>Support</Link>
          <span style={{ marginLeft: 'auto' }}>© ClubIt</span>
        </footer>
      </div>
    </div>
  )
}

export const H2 = ({ children }: { children: ReactNode }) => (
  <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0f1729', margin: '30px 0 8px' }}>{children}</h2>
)
export const P = ({ children }: { children: ReactNode }) => (
  <p style={{ margin: '0 0 12px' }}>{children}</p>
)
export const UL = ({ children }: { children: ReactNode }) => (
  <ul style={{ margin: '0 0 12px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</ul>
)
