import { describe, expect, it } from 'vitest'
import { applyLookupPatch, mergeNoteLine } from '../src/core'
import type { NoteLine } from '../src/core'

const kcalLine: NoteLine = {
  text: '~95 kcal · 25g carbs',
  owns: /^~\d+ kcal\b/,
}

describe('mergeNoteLine', () => {
  it('returns the line text when the note is null', () => {
    expect(mergeNoteLine({ note: null, line: kcalLine })).toBe(kcalLine.text)
  })

  it('returns the line text when the note is blank', () => {
    expect(mergeNoteLine({ note: '   ', line: kcalLine })).toBe(kcalLine.text)
  })

  it('appends the line on a new line when nothing matches owns', () => {
    const note = 'Buy from the corner shop'
    expect(mergeNoteLine({ note, line: kcalLine })).toBe(
      `${note}\n${kcalLine.text}`,
    )
  })

  it('appends without an extra blank line when the note already ends with a newline', () => {
    const note = 'Buy from the corner shop\n'
    expect(mergeNoteLine({ note, line: kcalLine })).toBe(
      `Buy from the corner shop\n${kcalLine.text}`,
    )
  })

  it('replaces the first matching line in place, keeping the rest', () => {
    const note = 'Buy from the corner shop\n~80 kcal · old note\nRemember bag'
    expect(mergeNoteLine({ note, line: kcalLine })).toBe(
      `Buy from the corner shop\n${kcalLine.text}\nRemember bag`,
    )
  })

  it('leaves every other character of the user note byte-identical', () => {
    const note = '  Weird   spacing \t and emoji 🥕\n~10 kcal · stale'
    expect(mergeNoteLine({ note, line: kcalLine })).toBe(
      `  Weird   spacing \t and emoji 🥕\n${kcalLine.text}`,
    )
  })

  it('only replaces the first matching line when several match', () => {
    const note = '~10 kcal · first\n~20 kcal · second'
    expect(mergeNoteLine({ note, line: kcalLine })).toBe(
      `${kcalLine.text}\n~20 kcal · second`,
    )
  })
})

describe('applyLookupPatch', () => {
  it('applies the note line and link from the patch', () => {
    const item = { note: null, link: null }
    expect(
      applyLookupPatch({
        item,
        patch: { noteLine: kcalLine, link: 'https://maps.example' },
      }),
    ).toEqual({ note: kcalLine.text, link: 'https://maps.example' })
  })

  it('leaves both fields untouched for an empty patch', () => {
    const item = { note: 'kept', link: 'https://kept.example' }
    expect(applyLookupPatch({ item, patch: {} })).toEqual(item)
  })

  it('keeps a link the user added even when the patch has a link', () => {
    const item = { note: null, link: 'https://booking.example' }
    expect(
      applyLookupPatch({ item, patch: { link: 'https://maps.example' } }),
    ).toEqual({ note: null, link: 'https://booking.example' })
  })
})
