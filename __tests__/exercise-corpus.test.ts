import { describe, expect, it } from 'vitest'
import { exerciseFor, formatPlan } from '../src/exercise'
import { EXERCISE_LINES } from './fixtures/exercise-lines'

const resolved = (line: string) => {
  const hit = exerciseFor(line)
  return hit ? [hit.entry.id, formatPlan(hit.plan)] : ['no-match']
}

describe('exercise line corpus', () => {
  it('has at least 120 lines', () => {
    expect(EXERCISE_LINES.length).toBeGreaterThanOrEqual(120)
  })

  it.each(EXERCISE_LINES)('%s', (line, ...expected) => {
    expect(resolved(line)).toEqual(expected)
  })
})
