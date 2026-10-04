import { describe, expect, it } from 'vitest'
import { diningIntent } from '../src/dining'
import {
  DINING_LINES,
  KNOWN_GAPS,
  type DiningLine,
} from './fixtures/dining-lines'

const OUTCOME = { book: 'B', venue: 'M', none: 'N' } as const

const outcome = ([text]: DiningLine) => OUTCOME[diningIntent(text).kind]

const isAcceptable = (line: DiningLine) =>
  line[1].split('|').includes(outcome(line))

// Wrong: "Book a table" where no booking is wanted; over-claim: a link where
// nothing is. A Maps place for a booking line is a fallback, not wrong.
const isWrong = (line: DiningLine) =>
  outcome(line) === 'B' && !line[1].split('|').includes('B')
const isOverClaim = (line: DiningLine) =>
  outcome(line) !== 'N' && line[1] === 'N'

const isGap = ([text]: DiningLine) => KNOWN_GAPS.includes(text)
const expected = DINING_LINES.filter((line) => !isGap(line))
const gaps = DINING_LINES.filter(isGap)

describe('dining line corpus', () => {
  it('has at least 250 lines', () => {
    expect(DINING_LINES.length).toBeGreaterThanOrEqual(250)
  })

  // The corpus is the contract: known gaps only shrink (22 at v1.0.0).
  it('has no more known gaps than before', () => {
    expect(KNOWN_GAPS.length).toBeLessThanOrEqual(22)
  })

  it('names each known gap exactly once, and only corpus lines', () => {
    const texts = DINING_LINES.map(([text]) => text)
    for (const gap of KNOWN_GAPS) {
      expect(texts.filter((text) => text === gap)).toHaveLength(1)
    }
    expect(new Set(KNOWN_GAPS).size).toBe(KNOWN_GAPS.length)
  })

  it('is never wrong and never over-claims', () => {
    expect(DINING_LINES.filter(isWrong).map(([text]) => text)).toEqual([])
    expect(DINING_LINES.filter(isOverClaim).map(([text]) => text)).toEqual([])
  })

  it('is acceptable on at least 90 % of lines', () => {
    const acceptable = DINING_LINES.filter(isAcceptable).length
    expect(acceptable / DINING_LINES.length).toBeGreaterThanOrEqual(0.9)
  })

  it.each(expected)('%s', (...line) => {
    expect(isAcceptable(line)).toBe(true)
  })

  it.each(gaps)('known gap: %s', (...line) => {
    expect(isAcceptable(line)).toBe(false)
  })
})
