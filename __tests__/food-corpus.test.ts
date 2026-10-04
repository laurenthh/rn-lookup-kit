import { describe, expect, it } from 'vitest'
import { resolveFood } from '../src/food'
import { FOOD_LINES } from './fixtures/food-lines'

describe('food line corpus', () => {
  for (const [line, id, grams] of FOOD_LINES) {
    it(`${line} → ${id}`, () => {
      const hits = resolveFood(line)
      if (id === 'no-match') {
        expect(hits).toBeNull()
      } else if (hits) {
        expect(hits.map((hit) => hit.entry.id).join('+')).toBe(id)
        const total = hits.reduce((sum, hit) => sum + hit.grams, 0)
        expect(total).toBeCloseTo(grams ?? 0, 0)
      }
    })
  }

  // v1.0.0 matches 98 %; the bar only rises.
  it('matches at least 97% of the lines that should match', () => {
    const expected = FOOD_LINES.filter(([, id]) => id !== 'no-match')
    const matched = expected.filter(([line]) => resolveFood(line) !== null)
    expect(matched.length / expected.length).toBeGreaterThanOrEqual(0.97)
  })
})
