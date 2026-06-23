'use client'

// Shared visual primitives for the mobile design system. Kept dependency-free
// (inline styles via css()) so admin/advisor/student screens compose the same
// building blocks.

import { css, TOP, avBg, initials as toInitials } from './css'

/** Injected once by MobileShell — the design's keyframes + scrollbar hiding. */
export function GlobalMobileStyles() {
  return (
    <style>{`
      .m-noscroll::-webkit-scrollbar{display:none}
      .m-noscroll{scrollbar-width:none;-ms-overflow-style:none}
      @keyframes scIn{from{transform:translateX(14px);opacity:.4}to{transform:translateX(0);opacity:1}}
      @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      @keyframes toastIn{from{opacity:0;transform:translate(-50%,14px)}to{opacity:1;transform:translate(-50%,0)}}
      @keyframes popIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
      @keyframes spin{to{transform:rotate(360deg)}}
    `}</style>
  )
}

export const Chevron = ({ stroke = '#c5cad3', size = 17 }: { stroke?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
)

export const BackButton = ({ onClick, light = false }: { onClick: () => void; light?: boolean }) => (
  <button
    onClick={onClick}
    style={css(
      light
        ? 'width:38px;height:38px;border-radius:50%;border:none;background:rgba(255,255,255,.22);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;cursor:pointer;'
        : 'width:38px;height:38px;border-radius:50%;border:1px solid #e7e8ec;background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;'
    )}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={light ? '#fff' : '#384152'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
  </button>
)

/** Initials avatar with deterministic color. */
export function Avatar({ name, size = 40, fontSize, bg }: { name: string; size?: number; fontSize?: number; bg?: string }) {
  return (
    <span
      style={{
        ...css(
          `width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:var(--font-manrope);flex:none;`
        ),
        fontSize: (fontSize ?? Math.round(size * 0.32)) + 'px',
        background: bg ?? avBg(name),
      }}
    >
      {toInitials(name)}
    </span>
  )
}

/** Big screen title block (Clubs, Students, …). Handles safe-area top padding. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  topExtra = 20,
  children,
}: {
  title: string
  subtitle?: string
  right?: React.ReactNode
  topExtra?: number
  children?: React.ReactNode
}) {
  return (
    <div style={{ ...css('padding:0 20px 12px;background:#f2f2f7;flex:none;'), paddingTop: TOP(topExtra) }}>
      <div style={css('display:flex;align-items:center;justify-content:space-between;gap:10px;')}>
        <div style={css('min-width:0;')}>
          <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:27px;letter-spacing:-.03em;color:#0f1729;")}>{title}</div>
          {subtitle && <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:2px;')}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

/** White rounded card container used across lists/detail. */
export function Card({ children, style = '', className }: { children: React.ReactNode; style?: string; className?: string }) {
  return (
    <div className={className} style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;box-shadow:0 1px 2px rgba(16,24,40,.04);' + style)}>
      {children}
    </div>
  )
}

/** Centered loading spinner for screens awaiting data. */
export function Loader() {
  return (
    <div style={css('flex:1;display:flex;align-items:center;justify-content:center;padding:60px 0;')}>
      <span style={css('width:26px;height:26px;border-radius:50%;border:3px solid #e2e3e8;border-top-color:#6366f1;animation:spin .7s linear infinite;display:block;')} />
    </div>
  )
}

/** Empty / error state card. */
export function EmptyState({ title, sub, tone = 'neutral' }: { title: string; sub?: string; tone?: 'neutral' | 'good' }) {
  const bg = tone === 'good' ? '#e8faf2' : '#eef0f3'
  const stroke = tone === 'good' ? '#10b981' : '#9aa0ac'
  return (
    <div style={css('background:#fff;border:1px solid #eef0f3;border-radius:18px;padding:38px 20px;text-align:center;box-shadow:0 1px 2px rgba(16,24,40,.04);animation:popIn .25s ease;')}>
      <div style={css(`width:48px;height:48px;border-radius:15px;background:${bg};display:flex;align-items:center;justify-content:center;margin:0 auto 12px;`)}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></svg>
      </div>
      <div style={css("font-family:var(--font-manrope);font-weight:800;font-size:16px;color:#0f1729;")}>{title}</div>
      {sub && <div style={css('font-size:12.5px;color:#9aa0ac;font-weight:500;margin-top:3px;')}>{sub}</div>}
    </div>
  )
}

/**
 * iOS-style search field. When `onChange` is provided it renders a live,
 * controlled input that filters in place; otherwise it stays a tappable
 * placeholder (for screens that route elsewhere to search).
 */
export function SearchBar({ placeholder, value, onChange, onClick }: { placeholder: string; value?: string; onChange?: (v: string) => void; onClick?: () => void }) {
  if (onChange) {
    return (
      <div style={css('display:flex;align-items:center;gap:9px;background:#e6e6ec;border-radius:12px;padding:9px 13px;margin-top:12px;')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
        <input
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={css('flex:1;min-width:0;border:none;background:none;outline:none;font-size:14px;color:#1f2734;font-weight:500;font-family:inherit;')}
        />
        {value ? <button onClick={() => onChange('')} style={css('border:none;background:none;cursor:pointer;padding:0;display:flex;')}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="10" fill="#c9cbd2" stroke="none" /><path d="M15 9l-6 6M9 9l6 6" stroke="#fff" /></svg></button> : null}
      </div>
    )
  }
  return (
    <div onClick={onClick} style={css('display:flex;align-items:center;gap:9px;background:#e6e6ec;border-radius:12px;padding:9px 13px;margin-top:12px;cursor:pointer;')}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a8f9a" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      <span style={css('font-size:14px;color:#8a8f9a;font-weight:500;')}>{placeholder}</span>
    </div>
  )
}
