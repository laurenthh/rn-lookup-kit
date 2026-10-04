import { describe, expect, it } from 'vitest'
import { FOODS } from '../src/food/foods'
import { matchFood, wholeFood } from '../src/food/match'

const idOf = (name: string) => matchFood(name)?.id ?? null

describe('matchFood', () => {
  it('matches names and aliases exactly, case and plural insensitive', () => {
    expect(idOf('Milk')).toBe('milk')
    expect(idOf('tomatoes')).toBe('tomato')
    expect(idOf('aubergine')).toBe('eggplant')
    expect(idOf('Courgettes')).toBe('zucchini')
    expect(idOf('scallions')).toBe('green-onion')
    expect(idOf('2% milk')).toBe('reduced-fat-milk')
    expect(idOf('ground beef 80/20')).toBe('ground-beef')
  })

  it('tries the full phrase before stripping fillers', () => {
    expect(idOf('diced tomatoes')).toBe('canned-tomato')
    expect(idOf('fresh basil')).toBe('basil')
    expect(idOf('organic spinach')).toBe('spinach')
    expect(idOf('minced garlic')).toBe('garlic')
    expect(idOf('free range eggs')).toBe('egg')
  })

  it('accepts the same words in another order, nothing looser', () => {
    expect(idOf('breast chicken')).toBe('chicken-breast')
    expect(idOf('beef ground')).toBe('ground-beef')
    expect(idOf('virgin oil')).toBeNull()
    expect(idOf('chicken breast extra')).toBeNull()
    expect(idOf('2 milk')).toBeNull()
    expect(idOf('soft cheese')).toBeNull()
  })

  it('misses on unknown words rather than guessing', () => {
    expect(idOf("Grandma's pesto")).toBeNull()
    expect(idOf('pink lady apples')).toBeNull()
    expect(idOf('dish soap')).toBeNull()
    expect(idOf('')).toBeNull()
  })

  it('misses on ambiguous or partial names', () => {
    expect(idOf('beef')).toBeNull()
    expect(idOf('cream')).toBeNull()
    expect(idOf('meat')).toBeNull()
    expect(idOf('apple cider')).toBeNull()
  })
})

describe('wholeFood', () => {
  it('resolves every name and alias to its own entry', () => {
    for (const entry of FOODS) {
      for (const term of [entry.name, ...entry.aliases]) {
        expect(`${term} → ${wholeFood(term)?.id}`).toBe(`${term} → ${entry.id}`)
      }
    }
  })

  it('strips fillers but never reorders', () => {
    expect(wholeFood('organic spinach')?.id).toBe('spinach')
    expect(wholeFood('breast chicken')).toBeNull()
    expect(wholeFood('2 milk')).toBeNull()
  })
})
