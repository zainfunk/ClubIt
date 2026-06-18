/**
 * Objectionable-content filter for user-generated text (App Store Guideline 1.2).
 *
 * ClubIt is used by students (minors), so chat enforces a zero-tolerance policy
 * for slurs and sexual/abusive language. This is a deliberately conservative,
 * server-side gate: matched messages are rejected before they are ever stored,
 * rather than masked, so abusive content never reaches another student.
 *
 * The list targets unambiguous hate slurs and explicit sexual terms. It is not
 * exhaustive moderation (no tool is) — it is the automated layer that backs the
 * human report/block/admin-action flow.
 */

// Stored without separators; matching is done on a normalized, de-leeted copy
// of the message so simple evasions (sp4ces, $ for s, etc.) still trip.
const BLOCKED_TERMS: string[] = [
  // Hate slurs
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'chink', 'spic', 'kike',
  'tranny', 'dyke', 'coon',
  // Explicit sexual content inappropriate for a minors' platform
  'cunt', 'whore', 'slut', 'rape', 'pedophile', 'pedo',
]

/** Collapse common letter-substitutions and spacing used to evade filters. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    // leetspeak / symbol substitutions
    .replace(/[@4]/g, 'a')
    .replace(/[$5]/g, 's')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/7/g, 't')
    // strip everything that isn't a letter so "n i g g e r" / "n.i.g.g.e.r" collapse
    .replace(/[^a-z]/g, '')
}

export interface ContentCheck {
  ok: boolean
  /** The term that triggered a block, for logging (never shown to the sender). */
  matched?: string
}

/**
 * Returns { ok: false, matched } if the text contains objectionable content.
 * Matches against a normalized copy so basic obfuscation is caught.
 */
export function checkContent(text: string): ContentCheck {
  const normalized = normalize(text)
  for (const term of BLOCKED_TERMS) {
    if (normalized.includes(term)) return { ok: false, matched: term }
  }
  return { ok: true }
}
