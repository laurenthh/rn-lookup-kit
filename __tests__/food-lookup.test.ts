import { describe, expect, it } from 'vitest'
import { foodLookup, resolveFood } from '../src/food'
import { FOOD_OWNS } from '../src/food/food'
import { buildItem } from './helpers/items'

const run = (text: string) => foodLookup.run(buildItem({ text }))

describe('foodLookup', () => {
  it('applies to every unchecked item and labels itself', () => {
    expect(foodLookup.tags).toEqual(['food'])
    expect(foodLookup.applies(buildItem({ text: 'anything' }))).toBe(true)
    expect(foodLookup.label(buildItem({}))).toBe('Look up nutrition')
  })

  it('writes one owned note line', async () => {
    await expect(run('1 apple')).resolves.toEqual({
      noteLine: {
        text: '~95 kcal · 25g carbs · 0.4g fat · 0.5g protein',
        owns: FOOD_OWNS,
      },
    })
    expect(FOOD_OWNS.flags).toBe('')
    expect(FOOD_OWNS.test('~95 kcal · 25g carbs')).toBe(true)
    expect(FOOD_OWNS.test('Buy ~95 kcal bars')).toBe(false)
  })

  it('prints per serving when there is no quantity', async () => {
    await expect(run('Olive oil')).resolves.toEqual({
      noteLine: { text: '~120 kcal per tbsp · 14g fat', owns: FOOD_OWNS },
    })
    await expect(run('minced beef')).resolves.toMatchObject({
      noteLine: { text: expect.stringMatching(/^~255 kcal per 100g/) },
    })
  })

  it('prints a combo as one summed line without a serving', async () => {
    await expect(run('eggs and toast')).resolves.toEqual({
      noteLine: {
        text: '~150 kcal · 15g carbs · 5.7g fat · 8.9g protein',
        owns: FOOD_OWNS,
      },
    })
  })

  it('misses on unknown names and on volumes without a density', async () => {
    await expect(run("Grandma's pesto")).resolves.toBe('no-match')
    await expect(run('1l bread')).resolves.toBe('no-match')
    await expect(run('')).resolves.toBe('no-match')
  })
})

describe('resolveFood', () => {
  const grams = (text: string) => {
    const [hit] = resolveFood(text) ?? []
    return hit ? [hit.entry.id, Math.round(hit.grams * 10) / 10, hit.per] : null
  }

  const combo = (text: string) =>
    resolveFood(text)?.map(({ entry, grams }) => [
      entry.id,
      Math.round(grams * 10) / 10,
    ]) ?? null

  it('uses medium, then piece, then a countable serving for a count', () => {
    expect(grams('2 eggs')).toEqual(['egg', 88, null])
    expect(grams('2 chicken breasts')).toEqual(['chicken-breast', 544, null])
    expect(grams('2 salmon')).toEqual(['salmon', 396, null])
  })

  it('prints the serving line when a count has no countable portion', () => {
    expect(grams('1 whole chicken')).toEqual(['whole-chicken', 100, '100g'])
    expect(grams('2 butter')).toEqual(['butter', 14.2, 'tbsp'])
    expect(grams('2 milk')).toEqual(['milk', 244, 'cup'])
    expect(grams('1 bread')).toEqual(['bread', 29, 'slice'])
    expect(grams('2 cashews')).toEqual(['cashew', 30, 'serving'])
    expect(grams('2 almonds')).toEqual(['almond', 2.4, null])
  })

  it('reads sizes as portions, falling back to a count', () => {
    expect(grams('1 large onion')).toEqual(['onion', 150, null])
    expect(grams('large eggs')).toEqual(['egg', 50, 'large'])
    expect(grams('1 large chicken breast')).toEqual([
      'chicken-breast',
      272,
      null,
    ])
  })

  it('derives spoons from a cup and volumes from a density', () => {
    expect(grams('1 tbsp flour')).toEqual(['flour', 7.8, null])
    expect(grams('1 cup olive oil')).toEqual(['olive-oil', 216, null])
    expect(grams('500ml milk')).toEqual(['milk', 515.5, null])
    expect(grams('1 tsp olive oil')).toEqual(['olive-oil', 4.5, null])
  })

  it('needs the exact portion for slices, cloves and pieces', () => {
    expect(grams('2 slices bread')).toEqual(['bread', 58, null])
    expect(grams('2 slices milk')).toBeNull()
  })

  it('weighs a handful by class, capped by the cup for airy foods', () => {
    expect(grams('a handful of almonds')).toEqual(['almond', 30, null])
    expect(grams('a handful of raisins')).toEqual(['raisin', 30, null])
    expect(grams('a handful of seeds')).toEqual(['seeds', 30, null])
    expect(grams('a handful of grapes')).toEqual(['grape', 80, null])
    expect(grams('2 handfuls of rice')).toEqual(['white-rice', 80, null])
    expect(grams('a handful of popcorn')).toEqual(['popcorn', 8, null])
    expect(grams('handful of spinach')).toEqual(['spinach', 30, 'handful'])
  })

  it('reads scoops, bowls and glasses from the serving or a default', () => {
    expect(grams('2 scoops protein powder')).toEqual(['whey-protein', 60, null])
    expect(grams('a scoop of ice cream')).toEqual(['ice-cream', 66, null])
    expect(grams('a scoop of rice')).toBeNull()
    expect(grams('a bowl of cereal')).toEqual(['cereal', 60, null])
    expect(grams('bowl of rice')).toEqual(['white-rice', 237, 'bowl'])
    expect(grams('a bowl of tuna')).toBeNull()
    expect(grams('a bowl of nuts')).toBeNull()
    expect(grams('a bowl of almonds')).toBeNull()
    expect(grams('a bowl of berries')).toEqual(['berries', 210, null])
    expect(grams('a glass of milk')).toEqual(['milk', 257.8, null])
    expect(grams('2 glasses of wine')).toEqual(['red-wine', 294, null])
    expect(grams('a glass of whisky')).toEqual(['whiskey', 42, null])
    expect(grams('a glass of flour')).toBeNull()
    expect(grams('a glass of olive oil')).toBeNull()
  })

  it('keeps the amount requirement unless the word is followed by of', () => {
    expect(grams('salad bowl')).toBeNull()
    expect(grams('wine glass')).toBeNull()
    expect(grams('glass milk')).toBeNull()
  })

  it('sums a combo only when every part matches', () => {
    expect(combo('bread and butter')).toEqual([
      ['bread', 29],
      ['butter', 14.2],
    ])
    expect(combo('yogurt, granola & berries')).toEqual([
      ['yogurt', 245],
      ['granola', 122],
      ['berries', 140],
    ])
    expect(combo('salt and pepper')).toBeNull()
    expect(combo('apples and oranges and pears and plums')).toBeNull()
  })

  it('carries the leading amount to parts without their own', () => {
    expect(combo('a handful of fruit and nuts')).toEqual([
      ['fruit', 80],
      ['nuts', 30],
    ])
    expect(combo('2 eggs and bacon')).toEqual([
      ['egg', 88],
      ['bacon', 28],
    ])
    expect(combo('2 eggs and 2 slices of toast')).toEqual([
      ['egg', 88],
      ['bread', 58],
    ])
    expect(combo('500g mince and onions')).toEqual([
      ['ground-beef', 500],
      ['onion', 110],
    ])
    expect(combo('2 cups rice and beans')).toEqual([
      ['white-rice', 316],
      ['beans', 360],
    ])
  })

  it('prefers the whole line over a split', () => {
    expect(combo('mac and cheese')).toEqual([['macaroni-and-cheese', 137]])
    expect(combo('2 cups mac and cheese')).toEqual([
      ['macaroni-and-cheese', 274],
    ])
    expect(combo('half and half')).toEqual([['half-and-half', 15]])
  })
})
