export type PortionKey =
  | 'small'
  | 'medium'
  | 'large'
  | 'cup'
  | 'tbsp'
  | 'tsp'
  | 'slice'
  | 'clove'
  | 'piece'
  | 'ml'

export type FoodPortions = Partial<Record<PortionKey, number>>

export type FoodServing = {
  label: string
  grams: number
}

// Groups that share a default weight for count-less amounts like a handful.
export type FoodClass = 'fruit' | 'dried fruit' | 'nuts' | 'seeds'

export type FoodEntry = {
  id: string
  name: string
  aliases: readonly string[]
  kcal: number
  carbs: number
  fat: number
  protein: number
  portions: FoodPortions
  serving: FoodServing
  class?: FoodClass
}
