import { describe, expect, it } from 'vitest'
import {
  KNOWN_GAPS,
  TRAVEL_LINES,
  type TravelLine,
} from './fixtures/travel-lines'
import { travelIntent } from './helpers/travel'

// Known gaps are asserted to STILL disagree: fixing one in src/ fails here
// until the line is moved out of KNOWN_GAPS, so the corpus never drifts.
const isGap = ([text]: TravelLine) => KNOWN_GAPS.includes(text)
const expected = TRAVEL_LINES.filter((line) => !isGap(line))
const gaps = TRAVEL_LINES.filter(isGap)

const classify = ([text, , tags = []]: TravelLine) =>
  travelIntent({ text, tags })

describe('travel line corpus', () => {
  it('has at least 250 lines', () => {
    expect(TRAVEL_LINES.length).toBeGreaterThanOrEqual(250)
  })

  // The corpus is the contract: known gaps only shrink (9 at v1.0.0).
  it('has no more known gaps than before', () => {
    expect(KNOWN_GAPS.length).toBeLessThanOrEqual(9)
  })

  it('names each known gap exactly once, and only corpus lines', () => {
    const texts = TRAVEL_LINES.map(([text]) => text)
    for (const gap of KNOWN_GAPS) {
      expect(texts.filter((text) => text === gap)).toHaveLength(1)
    }
    expect(new Set(KNOWN_GAPS).size).toBe(KNOWN_GAPS.length)
  })

  it.each(expected)('%s', (...line) => {
    expect(classify(line)).toEqual(line[1])
  })

  it.each(gaps)('known gap: %s', (...line) => {
    expect(classify(line)).not.toEqual(line[1])
  })
})
