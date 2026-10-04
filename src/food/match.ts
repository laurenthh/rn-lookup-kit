import { FOODS } from './foods'
import type { FoodEntry } from './types'
import { foodKey } from '../core/normalize'

const FILLERS =
  /\b(free range|fresh|organic|raw|ripe|chopped|sliced|diced|minced|grated|shredded|crushed|peeled|frozen|boneless|skinless|some|of|the)\b/g

const stripFillers = (key: string) =>
  key.replace(FILLERS, ' ').split(/\s+/).filter(Boolean).join(' ')

const anyOrder = (key: string) => key.split(' ').sort().join(' ')

type Index = {
  exact: Map<string, FoodEntry>
  sorted: Map<string, FoodEntry | null>
}

// Lazy: the lookup setting is off by default.
let index: Index | undefined

const buildIndex = (): Index => {
  const exact = new Map<string, FoodEntry>()
  const sorted = new Map<string, FoodEntry | null>()
  for (const entry of FOODS) {
    for (const term of [entry.name, ...entry.aliases]) {
      const key = foodKey(term)
      exact.set(key, entry)
      const loose = anyOrder(key)
      const existing = sorted.has(loose) ? sorted.get(loose) : entry
      sorted.set(loose, existing === entry ? entry : null)
    }
  }
  return { exact, sorted }
}

// No reordering, so `2 percent milk` never absorbs a count.
export const wholeFood = (text: string): FoodEntry | null => {
  const { exact } = (index ??= buildIndex())
  const key = foodKey(text)
  return exact.get(key) ?? exact.get(stripFillers(key)) ?? null
}

export const matchFood = (name: string): FoodEntry | null => {
  const { sorted } = (index ??= buildIndex())
  return (
    wholeFood(name) ?? sorted.get(anyOrder(stripFillers(foodKey(name)))) ?? null
  )
}
