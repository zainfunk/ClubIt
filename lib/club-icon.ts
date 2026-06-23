// Club emoji resolution, shared across the mobile and desktop surfaces so a
// club shows the SAME icon everywhere. Prefer the admin-chosen emoji
// (clubs.icon_url); fall back to a deterministic guess from tags/name for
// clubs created before the icon field existed (e.g. older seed data).

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

// Prefer the explicit icon the creator chose; only fall back to the guess.
export function clubGlyph(club: { iconUrl?: string | null; tags?: string[]; name: string }): string {
  const icon = club.iconUrl?.trim()
  return icon || clubIcon(club.tags, club.name)
}
