import type { FoodEntry } from './types'

import foods from './foods.json'

// JSON imports widen `class` to string; the build writes FoodEntry[].
export const FOODS = foods as readonly FoodEntry[]
