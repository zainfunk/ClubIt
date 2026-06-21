import { describe, it, expect } from 'vitest'
import { checkContent, censorProfanity } from '@/lib/content-filter'

describe('checkContent (hard block)', () => {
  it('blocks unambiguous slurs even when obfuscated', () => {
    expect(checkContent('you are a f4ggot').ok).toBe(false)
    expect(checkContent('n i g g e r').ok).toBe(false)
  })

  it('allows ordinary messages', () => {
    expect(checkContent('great meeting today, see you all next week!').ok).toBe(true)
  })
})

describe('censorProfanity (mask in place)', () => {
  it('masks profanity but keeps the message', () => {
    const r = censorProfanity('this is so damn hard')
    expect(r.censored).toBe(true)
    expect(r.text).toBe('this is so **** hard')
  })

  it('catches leetspeak / symbol evasions', () => {
    expect(censorProfanity('sh1t').text).toBe('****')
    expect(censorProfanity('what a$$').text).toBe('what ***')
    expect(censorProfanity('f*ck').text).toBe('****')
  })

  it('does NOT trip on innocent words containing a swear (Scunthorpe problem)', () => {
    for (const clean of [
      'classic', 'assassin', 'passage', 'bass', 'pass', 'glass',
      'shiitake', 'Cockburn', 'scrap', 'hello', 'shell', 'assess', 'grass', 'analysis',
    ]) {
      const r = censorProfanity(`the word ${clean} is fine`)
      expect(r.censored, `"${clean}" should not be censored`).toBe(false)
      expect(r.text).toContain(clean)
    }
  })

  it('preserves length, punctuation and surrounding text', () => {
    const r = censorProfanity('damn, that is bullshit!')
    expect(r.text).toBe('****, that is ********!')
  })

  it('returns unchanged text when clean', () => {
    const r = censorProfanity('Looking forward to the bake sale on Friday.')
    expect(r.censored).toBe(false)
    expect(r.text).toBe('Looking forward to the bake sale on Friday.')
  })
})
