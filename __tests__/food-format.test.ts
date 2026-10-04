import { describe, expect, it } from 'vitest'
import { formatNutrition } from '../src/food/format'
import type { FoodEntry } from '../src/food/types'

const entry = (macros: Partial<FoodEntry>): FoodEntry => ({
  id: 'x',
  name: 'x',
  aliases: [],
  kcal: 0,
  carbs: 0,
  fat: 0,
  protein: 0,
  portions: {},
  serving: { label: 'cup', grams: 100 },
  ...macros,
})

const apple = entry({ kcal: 52, carbs: 13.8, fat: 0.2, protein: 0.3 })
const oil = entry({ kcal: 884, fat: 100 })

describe('formatNutrition', () => {
  it('prints kcal then the non-zero macros with a middle dot', () => {
    expect(formatNutrition([{ entry: apple, grams: 182, per: null }])).toBe(
      '~95 kcal · 25g carbs · 0.4g fat · 0.5g protein',
    )
  })

  it('adds the serving label when there was no quantity', () => {
    expect(formatNutrition([{ entry: oil, grams: 13.5, per: 'tbsp' }])).toBe(
      '~120 kcal per tbsp · 14g fat',
    )
    expect(formatNutrition([{ entry: oil, grams: 100, per: '100g' }])).toBe(
      '~885 kcal per 100g · 100g fat',
    )
  })

  it('rounds kcal to the nearest 5, or 1 under 10', () => {
    const line = (kcal: number) =>
      formatNutrition([{ entry: entry({ kcal }), grams: 100, per: null }])
    expect(line(0)).toBe('~0 kcal')
    expect(line(2.4)).toBe('~2 kcal')
    expect(line(9.6)).toBe('~10 kcal')
    expect(line(12)).toBe('~10 kcal')
    expect(line(13)).toBe('~15 kcal')
    expect(line(97.5)).toBe('~100 kcal')
  })

  it('sums a combo and drops the serving label', () => {
    expect(
      formatNutrition([
        { entry: apple, grams: 182, per: 'medium' },
        { entry: oil, grams: 13.5, per: 'tbsp' },
      ]),
    ).toBe('~215 kcal · 25g carbs · 14g fat · 0.5g protein')
  })

  it('gives grams one decimal under 10 and none from 10 up', () => {
    const line = (carbs: number) =>
      formatNutrition([{ entry: entry({ carbs }), grams: 100, per: null }])
    expect(line(0.04)).toBe('~0 kcal')
    expect(line(0.05)).toBe('~0 kcal · 0.1g carbs')
    expect(line(5)).toBe('~0 kcal · 5g carbs')
    expect(line(9.96)).toBe('~0 kcal · 10g carbs')
    expect(line(10.4)).toBe('~0 kcal · 10g carbs')
    expect(line(143.2)).toBe('~0 kcal · 143g carbs')
  })
})
