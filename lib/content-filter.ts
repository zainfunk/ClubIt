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

/**
 * Profanity word list for school-grade censoring. Unlike BLOCKED_TERMS (which
 * reject the whole message), these are MASKED in place so a message like
 * "this is so damn hard" becomes "this is so **** hard" and still goes through.
 *
 * Entries are matched whole-word (token by token) against a de-leeted copy of
 * each word, so:
 *   - obfuscations ("sh1t", "f@ck", "a$$") are still caught, and
 *   - innocent words that merely CONTAIN a swear are safe (the Scunthorpe
 *     problem): "class", "assassin", "passage", "shiitake", "Cockburn",
 *     "scrap", "Hello" never match because matching is per whole word.
 *
 * Keep this list lowercase and de-leeted (letters only) — the matcher
 * normalizes each word the same way before comparing. Plurals / common
 * inflections are listed explicitly where they're frequent.
 */
const PROFANITY_TERMS: string[] = [
  // f-word family
  'fuck', 'fucks', 'fucked', 'fucker', 'fuckers', 'fucking', 'fuckin', 'fuckface',
  'fuckboy', 'fuckwit', 'fuckhead', 'motherfucker', 'motherfuckers', 'motherfucking',
  'mofo', 'fuk', 'fuc', 'fck', 'fcked', 'fcking', 'fukin', 'fukn', 'fux', 'wtf', 'stfu', 'gtfo',
  'clusterfuck', 'fuckton',
  // s-word family
  'shit', 'shite', 'shits', 'shitty', 'shitted', 'shitting', 'shittin', 'shitter',
  'shithead', 'shithole', 'shitload', 'shitshow', 'shitstorm', 'shitbag', 'shitface',
  'bullshit', 'bullshitting', 'horseshit', 'dipshit', 'dumbshit', 'apeshit', 'batshit',
  'sht', 'shyt',
  // b-word family
  'bitch', 'bitches', 'bitching', 'bitchin', 'bitchy', 'biatch', 'biotch', 'sonofabitch',
  // a-word family (whole-word only, so "class"/"pass"/"bass" are safe)
  'ass', 'asses', 'asshole', 'assholes', 'asshat', 'assclown', 'asswipe', 'assface',
  'jackass', 'dumbass', 'dumbasses', 'badass', 'smartass', 'fatass', 'hardass', 'kickass',
  'arse', 'arsehole', 'arsehat',
  // d-word / private parts (whole-word only)
  'dick', 'dicks', 'dickhead', 'dickheads', 'dickwad', 'dickface', 'dickish',
  'cock', 'cocks', 'cocksucker', 'cocksuckers', 'cockhead', 'cockface',
  'pussy', 'pussies', 'prick', 'pricks', 'penis', 'penises', 'vagina', 'vaginas',
  'boner', 'boners', 'dildo', 'dildos', 'jizz', 'cum', 'cumming', 'wank', 'wanker',
  'wankers', 'wanking', 'jerkoff', 'handjob', 'blowjob', 'tits', 'titty',
  'titties', 'boob', 'boobs', 'boobies', 'nutsack', 'ballsack', 'scrotum',
  // bastard / damn / hell / crap family (whole-word: "Hello"/"shell"/"scrap" safe)
  'bastard', 'bastards', 'damn', 'damned', 'damnit', 'dammit', 'goddamn', 'goddamned',
  'goddammit', 'godammit', 'hell', 'helluva', 'crap', 'craps', 'crappy', 'crapped',
  'piss', 'pissed', 'pissing', 'pisser', 'pissoff',
  // British / misc
  'bollocks', 'bugger', 'buggered', 'wanky', 'twat', 'twats', 'minger', 'minging',
  'douche', 'douchebag', 'douchebags', 'douchey', 'skank', 'skanky', 'hoe', 'hoes',
  'thot', 'thots', 'milf', 'fml', 'omfg',
  // anatomical / scatological mild
  'turd', 'turds', 'fart', 'farts', 'farted', 'farting', 'butthole', 'buttholes',
  'horny', 'orgasm', 'porn', 'porno', 'pornhub', 'masturbate', 'masturbating',
]

const PROFANITY_SET = new Set(PROFANITY_TERMS)

// De-leet a single word for whole-word comparison: lowercase, fold common
// symbol/number substitutions, strip anything that isn't a letter.
function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[@4]/g, 'a')
    .replace(/[$5]/g, 's')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/3/g, 'e')
    .replace(/7/g, 't')
    .replace(/[^a-z]/g, '')
}

export interface CensorResult {
  text: string
  censored: boolean
}

/**
 * Replace any whole word that is profanity with asterisks, preserving the
 * original word length, spacing, and surrounding punctuation. Returns the
 * cleaned text plus whether anything was changed.
 *
 * Matching is per word against a de-leeted copy, so it catches "sh1t" / "a$$"
 * but never trips on innocent words that merely contain a swear as a substring.
 */
export function censorProfanity(text: string): CensorResult {
  let censored = false
  // A "word" is a run of letters/digits and the in-word leet symbols (@ $ *).
  // Note: '!' and '|' are deliberately excluded — they're normally sentence
  // punctuation, so absorbing a trailing "!" would corrupt the match (e.g.
  // "bullshit!" -> de-leet '!'->'i' -> "bullshiti", which wouldn't match).
  const cleaned = text.replace(/[A-Za-z0-9@$*]+/g, (word) => {
    const norm = normalizeWord(word)
    if (norm.length >= 2 && PROFANITY_SET.has(norm)) {
      censored = true
      return '*'.repeat(word.length)
    }
    return word
  })
  return { text: cleaned, censored }
}
