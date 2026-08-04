import { describe, expect, it } from 'vitest'
import { singleLineTitle } from './positioning'

// The governed title is stored as two lines so the hero can render the approved composition without
// hard-coding a title of its own. Machine-readable consumers (`Person.jobTitle`) need it flat.
describe('singleLineTitle', () => {
  it('collapses the approved line break into a single space', () => {
    expect(singleLineTitle('Full-Stack JavaScript\nProduct Engineer')).toBe(
      'Full-Stack JavaScript Product Engineer'
    )
  })

  it('leaves an already-single-line title untouched', () => {
    expect(singleLineTitle('Full-Stack JavaScript Product Engineer')).toBe(
      'Full-Stack JavaScript Product Engineer'
    )
  })

  it('normalises CRLF, tabs, runs of whitespace, and surrounding padding', () => {
    expect(singleLineTitle('  Full-Stack JavaScript\r\n\tProduct   Engineer  ')).toBe(
      'Full-Stack JavaScript Product Engineer'
    )
  })

  it('never emits a newline, whatever the stored value contains', () => {
    expect(singleLineTitle('a\nb\nc')).not.toContain('\n')
  })
})
