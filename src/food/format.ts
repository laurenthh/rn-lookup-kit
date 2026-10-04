import type { FoodEntry } from './types'

export type FoodHit = { entry: FoodEntry; grams: number; per: string | null }

const roundKcal = (kcal: number) =>
  kcal < 10 ? Math.round(kcal) : Math.round(kcal / 5) * 5

const formatGrams = (grams: number) => {
  const rounded = grams < 10 ? Number(grams.toFixed(1)) : Math.round(grams)
  return rounded === 0 ? null : `${rounded}g`
}

// A combo sums its parts and has no single serving to print `per`.
export const formatNutrition = (hits: readonly FoodHit[]) => {
  const total = (per100: (entry: FoodEntry) => number) =>
    hits.reduce(
      (sum, { entry, grams }) => sum + (per100(entry) * grams) / 100,
      0,
    )
  const per = hits.length === 1 ? hits[0]?.per : null
  const macros = [
    ['carbs', total((entry) => entry.carbs)],
    ['fat', total((entry) => entry.fat)],
    ['protein', total((entry) => entry.protein)],
  ] as const

  return [
    `~${roundKcal(total((entry) => entry.kcal))} kcal${per ? ` per ${per}` : ''}`,
    ...macros.flatMap(([label, grams]) => {
      const text = formatGrams(grams)
      return text ? [`${text} ${label}`] : []
    }),
  ].join(' · ')
}
