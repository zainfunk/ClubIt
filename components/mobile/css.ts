// Shared core for the ClubIt mobile design system (admin / advisor / student).
//
// The design is expressed as the prototype's exact inline CSS. `css()` parses
// those declaration strings into React style objects so screens stay faithful
// to the design and trivially diffable against it.

import type { CSSProperties } from 'react'

export function css(str: string): CSSProperties {
  const out: Record<string, string> = {}
  for (const decl of str.split(';')) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const key = decl.slice(0, i).trim()
    const val = decl.slice(i + 1).trim()
    if (!key) continue
    out[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val
  }
  return out as CSSProperties
}

// Safe-area-aware paddings (iOS notch / Dynamic Island / home indicator).
// Fall back to the +Npx on web where env() resolves to 0.
export const TOP = (extra = 20) => `calc(env(safe-area-inset-top, 0px) + ${extra}px)`
export const BOTTOM = (extra = 10) => `calc(env(safe-area-inset-bottom, 0px) + ${extra}px)`

// Height the tab bar occupies, so scroll views can pad their bottom past it.
export const TABBAR_SPACE = 84

// Deterministic avatar color from a seed (name / id), matching the design palette.
const AV = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9', '#ef4444', '#14b8a6', '#f43f5e', '#3b82f6']
export function avBg(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AV[h % AV.length]
}
export function initials(name: string): string {
  const p = (name || '').trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '?'
}

// Club emoji/tint inference (real clubs have no emoji field; derive from tags).
export function clubIcon(tags: string[] | undefined, name: string): string {
  const t = (tags ?? []).map(x => x.toLowerCase())
  const n = name.toLowerCase()
  if (t.some(x => ['stem', 'robotics', 'engineering'].includes(x)) || /robot/.test(n)) return '🤖'
  if (t.some(x => ['software', 'coding', 'computer'].includes(x)) || /cod|comp/.test(n)) return '💻'
  if (/chess/.test(n)) return '♟️'
  if (t.some(x => ['environment', 'community'].includes(x)) || /environ|green|eco/.test(n)) return '🌱'
  if (t.some(x => ['theatre', 'performance', 'drama'].includes(x)) || /drama|theat/.test(n)) return '🎭'
  if (t.some(x => ['art', 'arts', 'creative'].includes(x)) || /art/.test(n)) return '🎨'
  if (t.some(x => ['debate', 'speaking'].includes(x)) || /debate|speech/.test(n)) return '🗣️'
  if (t.some(x => ['photography'].includes(x)) || /photo/.test(n)) return '📷'
  if (/music|band/.test(n)) return '🎵'
  if (/sport|athlet|soccer|basket/.test(n)) return '⚽'
  if (/science|bio|chem|physics/.test(n)) return '🔬'
  if (/book|read|liter/.test(n)) return '📚'
  return '⭐'
}

const TINTS = ['#eef0ff', '#fdecf2', '#e8faf2', '#fff7e6', '#eef0f3', '#f3edff']
const GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#818cf8)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#475569,#64748b)',
  'linear-gradient(135deg,#0ea5e9,#38bdf8)',
]
export function tintFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return TINTS[h % TINTS.length]
}
export function gradientFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}
