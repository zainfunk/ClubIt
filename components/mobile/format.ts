// Small date/time helpers shared by mobile screens.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayName(dow: number): string {
  return DAYS[dow] ?? ''
}
export function dayShort(dow: number): string {
  return DAYS_SHORT[dow] ?? ''
}

/** "3:00–4:30 PM" style from "15:00"/"16:30" 24h strings. */
export function timeRange(start?: string, end?: string): string {
  const fmt = (t?: string) => {
    if (!t) return ''
    const [h, m] = t.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hr = h % 12 === 0 ? 12 : h % 12
    return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
  }
  if (start && end) return `${fmt(start)} – ${fmt(end)}`
  return fmt(start) || fmt(end)
}

/** Chat-list relative time: "10:01", "Yesterday", "Mon", or "Apr 3". */
export function relTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(/\s/g, '')
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  const diffDays = (now.getTime() - d.getTime()) / 86_400_000
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Event date -> { month: "APR", day: "20" } from "YYYY-MM-DD". */
export function monthDay(dateStr: string): { month: string; day: string } {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return { month: '', day: '' }
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: String(d.getDate()),
  }
}
